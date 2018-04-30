const xml2js = require( 'xml2js' );
const fs = require( 'fs' );
const path = require( 'path' );
const xmllint = require( './xmllint' );
const mkdirp = require( 'mkdirp' );
const sha = require( 'sha.js' );
const once = require('once');

class SubmissionInformationPackage {

    static validateMetadata ( file, schema, callback ) {
        xmllint.validateXML( {
            xml: file,
            schema: schema
        }, ( err, errors ) => {
            if ( err ) {
                return callback( err );
            }

            callback( null, errors );
        } );
    }

      	static calculateChecksum ( folder, file, callback ) {
          	callback = once( callback );

          	const stream = fs.createReadStream( path.join( folder, file ) );

          	const checksum = sha( 'sha256' );

          	stream.on( 'data', data => checksum.update( data ) );

          	stream.on( 'error', err => callback( err ) );

            stream.on( 'end', () => callback( null, checksum.digest( 'hex' ) ) );
        }

      	static validateFiles ( checksums, filesList, folder, callback ) {
        	if ( filesList.length == 0 ) {
            	return callback( null, [] );
            }

          	fs.exists( path.join( folder, filesList[ 0 ].path ), ( exists ) => {
              	SubmissionInformationPackage.validateFiles( checksums, filesList.slice( 1 ), folder, ( err, errors ) => {
                	if ( err ) {
                    	return callback( err );
                    }

                  	// Portanto, se o ficheiro existir nós calculamos o seu checksum
                    //assumo que o ckecksum do ficheiro está em checksums[ filesList[ 0 ] ]?
                  	// sim ok
                    if ( exists ) {
                    	SubmissionInformationPackage.calculateChecksum( folder, filesList[ 0 ], ( err, checksum ) => {
                        	if ( err ) {
                              return callback( err );
                            }

                          	if ( checksum != checksums[ filesList[ 0 ] ] ) {
                            	callback( null, [ 'Ficheiro adulterado: ' + filesList[ 0 ].path, ...errors ] );
                            } else {
                              	callback( null, errors );
                            }
                        } );
                    } else {
                    	callback( null, [ 'Ficheiro em falta: ' + filesList[ 0 ].path, ...errors ] );
                    }
                } );
            } );
        }

  	static moveFiles ( filesList, src, dest, callback ) {
    	if ( filesList.length == 0 ) {
        	return callback( null );
        }


        const file = filesList[ 0 ].path;

      	mkdirp( path.dirname( path.join( dest, file ) ), ( err ) => {
        	if ( err ) {
            	return callback( err );
            }

          	fs.copyFile( path.join( src, file ), path.join( dest, file ), ( err ) => {
            	SubmissionInformationPackage.moveFiles( filesList.slice( 1 ), src, dest, callback );
            } );
        } );
    }

    static convertMixedXml ( element ) {
        if ( element[ '#name' ] == '__text__' ) {
            return element._;
        }

        let body = element.$$.map( el => this.convertMixedXml( el ) );

        return {
            type: element[ '#name' ],
            attributes: element[ "$" ],
            body
        };
    }

    static parseMetadata ( file, callback ) {
      fs.readFile( file, 'utf8', ( err, content ) => {
            if ( err ) {
                return callback( err );
            }

            var parser = new xml2js.Parser( {
                explicitChildren: true,
                preserveChildrenOrder: true,
                charsAsChildren: true
            } );

            parser.parseString( content, ( err, content ) => {
                if ( err ) {
                    return callback( err );
                }

                const person = node => ( { name: node.name[ 0 ] ? node.name[ 0 ]._ : null, email: node.email[ 0 ] ? node.email[ 0 ]._ : null } );

                const abstract = this.convertMixedXml( content.package.abstract[ 0 ] );

                callback( null, {
                    meta: {
                        title: content.package.meta[ 0 ].title[ 0 ]._,
                        publishedDate: content.package.meta[ 0 ][ 'published-date' ][ 0 ]._,
                        type: content.package.meta[ 0 ].type[ 0 ]._,
                        access: content.package.meta[ 0 ].access[ 0 ]._,
                    },
                    authors: content.package.authors[ 0 ].author.map( person ),
                    supervisors: content.package.supervisors[ 0 ].supervisor.map( person ),
                    keywords: content.package.keywords[ 0 ].keyword.map( k => k._ ),
                    abstract: abstract,
                    files: content.package.files[ 0 ].file.map( file => {
                        return {
                            description: file._,
                            path: file.$.path
                        };
                    } )
                } );
            } );
        } );
    }

    static buildMixedXml ( node ) {
    	if ( typeof node === 'string' ) {
        	return { _: node };
        }

      	return {
        	[ node.type ]: {
                $: node.attributes,
                $$: node.body.map( subNode => SubmissionInformationPackage.buildMixedXml( subNode ) )
            }
        };
    }

    static buildMetadata ( pkg ) {
        var xmlObject = {
            package: {
                meta: {
                    title: pkg.meta.title,
                },
                authors: {
                    author: Array.from( pkg.authors ).map( author => ( {
                        name: author.name, email: author.email,
                          course: author.course, id: author.id
                    } ) )
                },
                  supervisors: {
                    supervisor: Array.from( pkg.supervisors ).map( supervisor => ( {
                          name: supervisor.name, email: supervisor.email,
                      } ) ),
                },
                  keywords: {
                    keyword: Array.from( pkg.keywords )
                  },
                abs: [ [ { _: "Ola" }, { teste: 1 }, "Adues", { sss: 2 } ] ],
                abstract: this.buildMixedXml( pkg.abstract ),
                  files: {
                    file: Array.from( pkg.files ).map( file => ( {
                        $: { path: file.path },
                          _: file.description
                    } ) )
                }
            }
        };

        var builder = new xml2js.Builder( {
            explicitArray: true
        } );

        var xmlString = builder.buildObject( xmlObject );

        console.log( xmlString )

        return xmlString;
    }
}

module.exports = { SubmissionInformationPackage };
