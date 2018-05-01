var express = require( 'express' );
var router = express.Router();
var { SubmissionInformationPackage } = require( '../services/sip' );
var { Compressed } = require( '../services/compressed' );
var { Logger } = require( '../services/logger' );
var { Package } = require( '../services/database' );
var {allowGroups}=require('../services/login');
var multer = require( 'multer' );
var rmdir = require( 'rmdir' );
var fs = require( 'fs' );
var uid = require( 'uid-safe' );
var path = require( 'path' );
var sanitize = require( 'sanitize-filename' );
var BagIt = require('bagit-fs');
var mkdirp=require('mkdirp');
var { format } = require( 'date-fns' );

var upload = multer( {
    dest: 'uploads/'
} );

function cleanup( ...folders ) {
    for ( let folder of folders ) {
        fs.exists( folder, exists => {
            if ( exists ) {
                rmdir( folder, ( err ) => err && console.log( err ) );
            }
        } );
    }
}

router.get( '/', ( req, res, next ) => {

    const packagesPerPage = 2;

    const currentPage = parseInt( req.query.page || 0 );

    const searchQuery = req.query.search || '';
    const searchMine = req.query.mine == 'on';
    const searchWaiting = req.query.waiting == 'on';
    const searchApproved = req.query.approved == 'on';
    const searchSort = req.query.sort || 'title';

    let query = {};

    if ( searchQuery ) {
        query.$text = { $search: searchQuery };
    }

    if ( searchApproved && !searchWaiting ) {
        query.approved = true;
    } else if ( !searchApproved && searchWaiting ) {
        query.approved = false;
    }

    if ( searchMine && req.user ) {
        query.createdBy = req.user._id;
    }

    Package.find( query ).sort( { [ searchSort ]: 'asc' } ).skip( currentPage * packagesPerPage ).limit( packagesPerPage ).exec( ( err, packages ) => {
        if ( err ) {
            return next( err );
        }

        res.render( 'packages/list', {
            packages: packages,
            currentPage: currentPage,
          	hasNextPage: packages.length == packagesPerPage,
            hasPreviousPage: currentPage > 0,
            searchQuery, searchSort, searchMine, searchWaiting, searchApproved
        } );
    } );
} );


router.get( '/submit', allowGroups( [ 'producer', 'admin' ] ), ( req, res, next ) => {
    res.render( 'packages/submit' );
} );

router.post( '/submit', allowGroups( [ 'producer', 'admin' ] ), upload.single( 'file' ), ( req, res, next ) => {
    const id = uid.sync( 20 );

    const uploadFolder = 'uploads/unzipped/' + id;
    const storageFolder = 'storage/packages/' + id;

    Compressed.unzip( req.file.path, uploadFolder, err => {
        if ( err ) {
            cleanup( req.file.path, uploadFolder );

            return next( err );
        }

        SubmissionInformationPackage.validateMetadata( uploadFolder + '/data/package.xml', 'schema.xsd', ( err, errors ) => {
            if ( err ) {
                cleanup( req.file.path, uploadFolder );

                return next( err );
            }

            if ( errors.length ) {
                cleanup( req.file.path, uploadFolder );

                return res.render( 'submit-received', {
                    errors: errors
                } );
            }

            SubmissionInformationPackage.parseMetadata( uploadFolder + '/data/package.xml', ( err, package ) => {
                if ( err ) {
                    cleanup( req.file.path, uploadFolder );

                    return next( err );
                }

              	var bag = Bagit( uploadFolder );

              	bag.readManifest( ( err, entries ) => {
                	if ( err ) {
                    	cleanup( req.file.path, uploadFolder );

                        return next( err );
                    }

                  	const checksums = {};

                  	for ( let entry of entries ) {
                      if(entry.name && entry.name.startsWith('data/')){
                        checksums[entry.name.slice('data/'.length)]=entry.checksum;
                      }
                    }

                    SubmissionInformationPackage.validateFiles( checksums, package.files, uploadFolder + '/data', ( err, missingFiles ) => {
                        if ( err ) {
                            cleanup( req.file.path, uploadFolder );

                            return next( err );
                        }

                        if ( missingFiles.length ) {
                            cleanup( req.file.path, uploadFolder );

                            return res.render( 'submit-received', {
                                errors: missingFiles
                            } );
                        }

                        SubmissionInformationPackage.moveFiles( package.files, uploadFolder + '/data', storageFolder, ( err ) => {
                            if ( err ) {
                                cleanup( req.file.path, uploadFolder, storageFolder );

                                return next( err );
                            }


                            new Package( {
                                ...package,
                                folder: id,
                                approved: false,
                                approvedBy: null,
                                approvedAt: null,
                                createdBy: req.user.id
                            } ).save( ( err, result ) => {
                                if ( err ) {
                                    cleanup( req.file.path, uploadFolder, storageFolder );

                                    return next( err );
                                }

                                Logger.write( 'Package submitted: ' + package.meta.title, req.user );

                                cleanup( req.file.path, uploadFolder );
                                console.log(package);
                                res.render( 'submit-received', {
                                    name: req.body.name,
                                    file: req.file.originalname,
                                    package: package
                                } );
                            } );
                        } );
                    } );
            	} );
            } );
        } );
    } );
} );

router.get( '/:id', ( req, res, next ) => {
  Package.findById(req.params.id, ( err, package ) => {
    if ( err ) {
      return next( err );
    }

    package.visitsCount =(package.visitsCount||0)+1;
    package.save();

    const buildHtml = ( elem ) => {
      if ( typeof elem === 'string' ) {
        return elem;
      }
      const attributes = Object.keys( elem.attributes || {} )
      .map( key => key + '="' + elem.attributes[ key ] + '"' )
      .join( ' ' );

      return '<' + elem.type + ' ' + attributes + '>' + elem.body.map( buildHtml ).join( '' ) + '</' + elem.type + '>';
    };

    res.render( 'packages/detailed', {
      package: package,
      abstract: package.abstract.body.map( paragraph => buildHtml( paragraph ) ).join( '\n' ),
      format: format,
      canApprove: req.user && req.user.group=='admin'
    } );
  } );
} );

function readFolder ( folder, callback ) {
    const filesList = [];

    const fr = ( files, index, current, callback ) => {
        if ( index >= files.length ) {
            return callback( null, filesList );
        }

        var fp = path.join( current, files[ index ] );

        fs.stat( fp, ( error, file ) => {
            if ( error ) {
                return callback( error );
            }

            if( file.isFile() ) {
                filesList.push( path.relative( folder, fp ) );
                fr( files, index + 1, current, callback );
            } else {
                fs.readdir( fp, ( error, subfiles ) => {
                    fr( subfiles, 0, fp, ( error ) => {
                        if( error ) {
                            return callback( error );
                        }

                        fr( files, index + 1, current, callback );
                    } );
                } );
            }
        } );
    };

    fs.readdir( folder, ( error, files ) => {
        fr( files, 0, folder, callback );
    } );
}

router.get( '/:id/approve', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	Package.findById( req.params.id, ( err, package ) => {
      	if ( err ) {
          	return next( err );
        }
      	if ( !package.approved ) {
          	package.approved = true;
          	package.approvedAt = new Date();
          	package.approvedBy = req.user._id;

          	package.save( ( err ) => {
            	if ( err ) {
                	return next( err );
                }
                const backUrl = req.header( 'Referer' ) || ( '/packages/' + package._id );
                res.redirect( backUrl );
            } );
        }
    } );
} );

router.get( '/:id/download', ( req, res, next ) => {
    Package.findById( req.params.id, ( err, package ) => {
        if ( err ) {
            return next( err );
        }

        package.downloadsCount =(package.downloadsCount||0)+1;
        package.save();

        const random = uid.sync( 20 );

        const storageFolder = 'storage/bags/' + random;
      	const packageFolder = path.join( 'storage/packages/', package.folder )

      	const bag = BagIt( storageFolder );

      	const addFileToBagit = ( files, index, callback ) => {
          	if ( index >= files.length ) {
            	return callback( null );
            }

          	mkdirp( path.dirname( path.join( storageFolder, 'data', files[ index ] ) ), ( err ) => {
              	if ( err ) {
                  	return callback( err );
                }

                const writer = fs.createReadStream( path.join( packageFolder, files[ index ] ) )
                    .pipe( bag.createWriteStream( files[ index ] ) );

                writer.on( 'error', ( err ) => callback( err ) );

                writer.on( 'finish', () => addFileToBagit( files, index + 1, callback ) );
            } );
        };

        readFolder( packageFolder, ( err, files ) => {
          	if ( err ) {
            	return next( err );
            }

        	addFileToBagit( files, 0, err => {
                if ( err ) {
                    return next( err );
                }

                bag.finalize( err => {
                    if ( err ) {
                        return next( err );
                    }

                    Compressed.zip( storageFolder, ( err, zip ) => {
                        zip.addBuffer( new Buffer( SubmissionInformationPackage.buildMetadata( package ) ), 'data/package.xml' );

                        zip.end( size => {
                            if ( size > 0 ) {
                                res.set( 'Content-Length', size );
                            }

                            res.attachment( ( sanitize( package.meta.title ) || 'package' ) + '.zip' );

                            zip.outputStream.pipe( res );
                        } );
                    } );
                } );
        	} );
        } );
    } );
} );

module.exports = router;
