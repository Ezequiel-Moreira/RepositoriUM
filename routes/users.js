// routes/users.js

var express = require('express');
var router = express.Router();
var { allowGroups } = require( '../services/login.js' )

router.get('/', allowGroups( [ 'admin' ] ), (req, res, next) => {
		const usersPerPage = 10;
    const currentPage = +( req.query.page || 0 );
  	let query = {};

  	User.find( query ).sort({username:1}).skip( currentPage * usersPerPage ).limit( usersPerPage ).exec( ( err, users ) => {
    	if ( err ) {
        	return next( err );
        }
      	res.render( 'users/list', {
          users: users,
          currentPage: currentPage,
          hasNextPage: users.length == usersPerPage,
          hasPreviousPage: currentPage > 0
        } );
    } );
} );

module.exports = router;
