var express = require('express');
var router = express.Router();
var { allowGroups } = require( '../services/login.js' );
var {User}=require('../services/database.js');

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

router.get('/:username',allowGroups( [ 'admin' ] ),(req,res,next)=>{
  User.findOne({username:req.params.username},(err,user)=>{
    if(err){
      return next(err);
    }
    if(user){
      res.render('users/detailed',{
        user:user
      });
    }
  });
});

module.exports = router;
