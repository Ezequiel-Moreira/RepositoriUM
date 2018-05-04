var express = require( 'express' );
var router = express.Router();
var fs = require( 'fs' );
var path = require( 'path' );
var { User,Log,Package } = require( '../services/database' );
var { Logger } = require( '../services/logger' );
var {UsersManager} = require('../services/users');
var passport = require( 'passport' );
var Joi = require('joi');

function allowLoggedIn () {
  return (req,res,next)=>{
    if(!req.user){
      next(new Error('Permition denied:not logged in'));
    }else{
      next();
    }
  }
}

function allowLoggedOut () {
  return (req,res,next)=>{
    if(req.user){
      next(new Error('Permition denied:logged in'));
    }else{
      next();
    }
  };
}

/* GET home page. */
router.get( '/', function ( req, res, next ) {
    Package.find().exec((err,packages)=>{
      res.render('index',{
        title:'RepositoriUM',
        packages: packages,
        tabs: [ {
          title: 'Downloads',
          name: 'downloads',
          selected: true,
          packages: packages
        }, {
          title: 'Views',
          name: 'views',
          packages: []
        }, {
          title: 'Recent',
          name: 'Recent',
          packages: []
        } ]
      });
    });
} );

router.get( '/login', allowLoggedOut() ,( req, res, next ) => {
    res.render( 'login', {
        error: req.query.error == '1' ? 'Credenciais incorretas introduzidas.' : null
    } );
} );

router.post( '/login',allowLoggedOut(), passport.authenticate( 'local', {
    failureRedirect: '/login?error=1'
} ), ( req, res, next ) => {
    Logger.write( 'User logged in: ' + req.user.username, req.user );

    res.redirect( '/' );
} );

router.get( '/logout', allowLoggedIn(),( req, res, next ) => {
    req.logout();

    res.redirect( '/' );
} );

router.get( '/register', allowLoggedOut(), ( req, res, next ) => {
	res.render( 'register' );
} );

router.post( '/register', allowLoggedOut(), ( req, res, next ) => {
  	const errors = [];

  	User.find( { $or: [ { username: req.body.username }, { email: req.body.email } ] }, ( err, users ) => {
    	  if(users.find( user => user.username == req.body.username )){
          errors.push( 'Username already exists' );
        }
        if(users.find( user => user.email == req.body.email )){
          errors.push( 'Email already exists' );
        }

      	const schema = Joi.object().keys( {
        	username: Joi.string().alphanum().min( 6 ).max( 16 ).required(),
          	password: Joi.string().min( 6 ).max( 20 ).required(),
          	password_confirm: Joi.any().equal( Joi.ref( 'password' ) ).required(),
          	email: Joi.string().email()
        } );

      	var validation = Joi.validate( req.body, schema, { abortEarly: false } );

      	if ( validation.error ) {
        	errors.push( ...validation.error.details.map( err => err.message ) );
        }

      	if ( errors.length > 0 ) {
        	res.render( 'register', {
            	errors: errors,
              ...req.body
            } )
        } else {
        	UsersManager.create( req.body.username, req.body.password, req.body.email, 'consumer', false, ( err ) => {
            	if ( err ) {
                	return next( err );
                }

              	res.render( 'register', { success: true } );
            } );
        }
    } );
} );

module.exports = router;
