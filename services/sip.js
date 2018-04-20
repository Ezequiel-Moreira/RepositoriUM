var xml2js = require( 'xml2js' );
var fs = require( 'fs' );
var xmllint = require( './xmllint' )
var mkdirp = require( 'mkdirp' );
var path = require( 'path' );


class SubmissionInformationPackage {
	static convertMixedXml ( element ) {
				if ( element[ "#name" ] === "__text__" ) {
					return element._;
				}else{
						let body = element.$$.map( el => this.convertMixedXml( el ) );
						return {
								type: element[ "#name" ],
								attributes: element[ "$" ],
								body: body
						};
				}
		}

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

		static validateFiles ( filesList, folder, callback ) {
				if ( filesList.length == 0 ) {
					return callback( null, [] );
				}

				fs.exists( path.join( folder, filesList[ 0 ].path ), ( exists ) => {

						SubmissionInformationPackage.validateFiles( filesList.slice( 1 ), folder, ( err, errors ) => {
							if ( err ) {
									return callback( err );
								}

							callback( null, exists ? errors : [ 'Ficheiro em falta: ' + filesList[ 0 ].path, ...errors ] );
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
							SubmissionInformationPackage.moveFiles( filesList.slice( 1 ),src,dest, callback );
						} );
				} );
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
										keywords: content.package.keywords[ 0 ].keyword.map(k=>k._),
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
        	return node;
        }

      	// Acho que é isto. só não sei se temos de mudar um pouco para o caso dos parágrafos, mas de resto
      	// Vou testar
      	//ok
        return {
        	'#name': node.type,
          	$: node.attributes,
          	$$: node.body.map( subNode => SubmissionInformationPackage.buildMixedXml( subNode ) )
        };
    }

		static buildMetadata ( pkg ) {
      	// Este vai ser o objeto que vamos construir com os campos do pkg
        //Pode-se aceder aos campos do package usando pck.campo?
      	// sim, é um objeto normal que vem da base de dados
      	// por isso tem os mesmos campos da bd
    	//ok
        var xmlObject = {
            //vou assumir que colocar meta:pck.meta não funciona
          	// funciona se todos os campos tiverem exatamente o mesmo nome e o formato que já
          	// queres que eles fiquem no XML
          	// mas como no pkg as propriedades estão em camelCase e no xml em snake-case
          	// temos de converter manualmente

        	meta: {
            	title: pkg.meta.title,
              	// por exemplo
              	'published-date': pkg.meta.publishedDate,
              	type: pkg.meta.type,
              	access: pkg.meta.access,
              	context: pkg.meta.context
            },
          	// Estes acho que não têm nada diferente por isso poder ser assim
            //ok, portanto se no pck tiver um nome diferente do atributo que queremos contruir, temos de colocar manualmente
          	// sim
            //ok
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
          	// Depois temos de criar também uma função recursiva para criar o abstract
          	//ok
            abstract: "",
          	files: {
            	file: Array.from( pkg.files ).map( file => ( {
                	$: { path: file.path },
                  	_: file.description
                } ) )
            }
        };

      	var builder = new xml2js.Builder();

      	// E aqui ele faz o inverso do parser: pega num objeto e retorna a string associada
        //buildObject cria um objeto?
        //E ainda falta definir xmlObject, certo?
      	// buildObject retorna uma string com o formato de um xml
      	// e sim, ainda nos falta construir o xmlObject
        //ok
      	return builder.buildObject( xmlObject );
    }

}

module.exports = { SubmissionInformationPackage };
