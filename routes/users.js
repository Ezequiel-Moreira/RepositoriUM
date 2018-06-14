var express = require('express');
var router = express.Router();
var { allowGroups } = require( '../services/login.js' );
var { User,Package } = require( '../services/database.js' );
var qs = require( 'querystring' );
var { UsersManager } = require( '../services/users' );
var Joi = require( 'joi' );

router.get( '/', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	const usersPerPage = 5;

	const currentPage = +( req.query.page || 0 );

	let query = {};

	const searchQuery = req.query.search || '';
	const searchApproved = req.query.approved == 'on';
	const searchWaiting = req.query.waiting == 'on';

	if ( searchQuery ) {
		query.$text = { $search: searchQuery };
	}

	if ( searchApproved && !searchWaiting ) {
		query.approved = true;
	} else if ( !searchApproved && searchWaiting ) {
		query.approved = false;
	}

	User.find( query ).sort( { username: 1 } ).skip( currentPage * usersPerPage ).limit( usersPerPage ).exec( ( err, users ) => {
		if ( err ) {
			return next( err );
		}

		res.render( 'users/list', {
			users: users,
			currentPage: currentPage,
			hasNextPage: users.length == usersPerPage,
			hasPreviousPage: currentPage > 0,
			nextPageLink: '/users?' + qs.stringify( { ...req.query, page: currentPage + 1 } ),
			previousPageLink: '/users?' + qs.stringify( { ...req.query, page: currentPage - 1 } ),

			searchQuery, searchApproved, searchWaiting
		} );
	} );
} );

router.get( '/create', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	res.render( 'users/edit', { userData: {} } );
} );

router.post( '/create', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
		const errors = [];

		User.find( { $or: [ { username: req.body.username }, { email: req.body.email } ] }, ( err, users ) => {
			if ( users.find( user => user.username == req.body.username ) ) {
						errors.push( 'Username already exists' );
				}

				if ( users.find( user => user.email == req.body.email ) ) {
						errors.push( 'Email already exists' );
				}

				const schema = Joi.object().keys( {
					username: Joi.string().alphanum().min( 6 ).max( 16 ).required(),
						password: Joi.string().min( 6 ).max( 20 ).required(),
						password_confirm: Joi.any().equal( Joi.ref( 'password' ) ).required(),
						email: Joi.string().email().required(),
						group: Joi.string().valid( 'admin', 'producer', 'consumer' ).required(),
				} );

				var validation = Joi.validate( req.body, schema, { abortEarly: false } );

				if ( validation.error ) {
						errors.push( ...validation.error.details.map( err => err.message ) );
				}

				if ( errors.length > 0 ) {
						res.render( 'users/edit', {
								errors,
								userData: req.body
						} );
				} else {
						UsersManager.create( req.body.username, req.body.password, req.body.email, req.body.group, true, ( err, user ) => {
								if ( err ) {
										return next( err );
				}

								res.redirect( '/users/' + user.username );
						} );
				}
		} );
} );

router.get( '/:name/edit', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.name }, ( err, user ) => {
		if ( err ) {
			return next( err );
		}

		if ( user == null ) {
					return next( new Error( 'User not found.' ) );
				}

		res.render( 'users/edit', { userData: user } );
	} );
} );


router.post( '/:name/edit', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.name }, ( err, user ) => {
			if ( err ) {
			return next( err );
		}

			if ( user == null ) {
			return next( new Error( 'User not found.' ) );
			}

			const errors = [];

		User.find( { $or: [ { username: req.body.username }, { email: req.body.email } ] }, ( err, users ) => {
			if ( users.find( u => !u._id.equals( user._id ) && u.username == req.body.username ) ) {
				errors.push( 'Username already exists' );
				}

				if ( users.find( u => !u._id.equals( user._id ) && u.email == req.body.email ) ) {
				errors.push( 'Email already exists' );
				}

			const schema = Joi.object().keys( {
				username: Joi.string().alphanum().min( 6 ).max( 16 ).required(),
				password: Joi.string().min( 6 ).max( 20 ).allow( '' ),
				password_confirm: Joi.any().equal( Joi.ref( 'password' ) ),
				email: Joi.string().email().required(),
				group: Joi.string().valid( 'admin', 'producer', 'consumer' )
				} ).with( 'password', 'password_confirm' );

			var validation = Joi.validate( req.body, schema, { abortEarly: false } );

				if ( validation.error ) {
				errors.push( ...validation.error.details.map( err => err.message ) );
				}

				if ( errors.length > 0 ) {
				res.render( 'users/edit', {
					errors,
					userData: {
											...user,
											...req.body
										}
				} );
				} else {
				const updated = { ...req.body };

				if ( !req.body.password ) delete updated.password;

				if ( req.body.approved == 'on' ) updated.approved = true;
				else delete updated.approved;

				UsersManager.update( req.params.name, updated, ( err, user ) => {
					if ( err ) {
						return next( err );
						}

					res.redirect( '/users/' + user.username );
					} );
				}
			} );
	} );
} );

router.get( '/:name/approve', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.name }, ( err, user ) => {
		if ( err ) {
			return next( err );
		}

		if ( !user ) {
			return next( new Error( 'User "' + req.params.name + '" not found.' ) );
		}

		user.approved = true;

		user.save( ( err ) => {
			if ( err ) {
				return next( err );
			}

			const backUrl = req.header( 'Referer' ) || ( '/users/' + user.username );

			res.redirect( backUrl );
		} );
	} );
} );

router.get( '/:name/remove', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
  	// Um pequeno detalhe então: não vale a pena apagar utilizadores que já estejam apagados
	User.findOne( { username: req.params.name, deleted: false }, ( err, user ) => {
		if ( err ) {
			return next( err );
		}

		if ( !user ) {
			return next( new Error( 'User "' + req.params.name + '" not found.' ) );
		}

		const backUrl = req.query.redirect || req.header( 'Referer' ) || ( '/users/' + user.username );
		const confirmBackUrl = req.query.redirect || req.header( 'Referer' ) || ( '/users' );

      	// Em principio deve apagar, mas falta adicionar algumas condições
      	// Os utilizadores nem sempre devem poder ser apagados
      	//  - Acho que um utilizador não se deve poder apagar a ele próprio (mesmo que seja administrador)
      	//  - Um utilizador só pode ser apagador se não tiver nenhum projeto publicado
        // acho que sim
      	// uma coisa que eu vi agora, estava errado, nós só adicionamos o campo state aos packages, os utilizadores ainda não o têm
      	// depois temos de adicionar, até pode ser deleted
        //ok

      	// Prevenir que o utilizador se apage a ele próprio
      	if ( user._id.equals( req.user._id ) ) {
        	return next( new Error( 'User cannot delete itself.' ) );
        }

      	// E agora prevenir apagar um utilizador com packages publicos
      	Package.find( { createdBy: user._id, state: { $not: 'deleted' } }, ( err, packages ) => {
        	if ( err ) {
            	return next( err );
            }

          	// Se tivermos encontrado algum package, temos de abortar a remoção e mostrar um erro
            //portanto, mostramos o erro e todos os pacotes publicados que causam com que a remoção não possa acontecer
          	// exato. Por acaso uma coisa que depois podiamos pensar em adicionar era na página do utilizador uma lista de packages desse utilizador
            //boa ideia
          	if ( packages.length > 0 ) {
              	return next( new Error( 'Cannot erase user because of published packages: ' + packages.map( p => p.index ).join( ', ' ) ) );
            }

            // Ok, portanto agora temos dois casos:
            // - user.approved == true : delete lógico
            // - user.approved == false : delete físico

            if ( req.query.confirm == 'true' ) {
                if ( user.approved == true ) {
                  //portanto aqui temos de alterar um valor para estar "apagado"
                  //usamos um dos valores que já lá está, ou temos que definir um novo valor no objeto do utilizador?
                  // quando definimos o schema do utilizador no ficheiro services/database.js na altura já criamos um campo state que pode ter como valor 'deleted'
                    user.deleted = true;
                    user.save( ( err ) => {
                        if ( err ) {
                            return next( err );
                        }

                        res.redirect( backUrl );
                    } );
                } else {
                    user.remove( ( err ) => {
                        if ( err ) {
                            return next( err );
                        }

                        res.redirect( backUrl );
                    } );
                }
            } else {
                res.render( 'users/remove', { userDetails: user, redirectLink: backUrl, confirmRedirectLink: confirmBackUrl } );
            }
        } );
	} );
} );

router.get( '/:username', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.username }, ( err, user ) => {
	  	if ( err ) {
			return next( err );
	  	}

	  	if( !user ) {
			return next( new Error( 'User not found.' ) );
		}

      	Package.find( { createdBy: user._id }, ( err, packages ) => {
          	if ( err ) {
            	return next( err );
            }

          	res.render( 'users/detailed', {
                userDetails: user,
              	packages: packages
            } );
        } );
	} );
} );

module.exports = router;
