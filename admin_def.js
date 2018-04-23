var { User } = require( './services/database.js' );
var uid = require( 'uid-safe' );
var sha = require( 'sha.js' );

const username = 'EzequielCons';
const password = 'EzequielCons';

User.findOne( { username: username } ).then( user => {
    console.log( user );

    user.salt = uid.sync( 10 );
    user.password = sha( 'sha256' ).update( user.salt + password ).digest( 'hex' );
    user.group = 'admin';
    user.approved = true;

    return user.save();
} ).catch( err => console.error( err ) );
