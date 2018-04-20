var express = require( 'express' );
var router = express.Router();
var fs = require( 'fs' );
var path = require( 'path' );
var formidable = require( 'formidable' );
var util = require( 'util' );
var passport = require('passport');
var multer = require( 'multer' );

var upload = multer( {
    dest: 'uploads/'
} );

var SubmissionInformationPackage = require( '../services/sip.js' );
var {Compressed} = require( '../services/compressed.js' );
var {Log} = require('../services/database.js');
var {Logger} = require('../services/logger');


router.get( '/', function ( req, res, next ) {
  fs.readFile( path.join( __dirname, '..', 'schema.xsd' ), 'utf8', ( err, contents ) => {
    if ( err ) {
      return next( err );
    }
    res.render( 'index', {
      title: 'Express',
      schema: contents
    } );
  } );
} );


router.get( '/login', ( req, res, next ) => {
    res.render( 'login', {
        error: req.query.error == '1' ? 'Credenciais incorretas introduzidas.' : null
    } );
} );

router.post( '/login', passport.authenticate( 'local', {
	failureRedirect: '/login?error=1'
} ), ( req, res, next ) => {
    var Login = Logger.write("User logged in ",req.user);

    res.redirect( '/' );

  	loginLog.save( err => {
        if ( err ) {
        	console.error( err.message, err.stack );
        }
    } );
} );

router.get('/logout',(req,res,next)=>{
  req.logout();
  res.redirect('/');
});

module.exports = router;
