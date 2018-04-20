var { User } = require( './services/database.js' );
var uid = require( 'uid-safe' );
var sha = require( 'sha.js' );
// Para ver só os utilizadores que tinha na BD (só tinha um)
User.find().then( users => console.log( users ) )

// Então peguei no primeiro, adicionei o salt e atualizei
User.findOne().then( user => {
    console.log( user );

  	// Aqui, convém colocar então um salt como deve ser
    user.salt = uid.sync( 10 );
  	user.password = sha( 'sha256' ).update( user.salt + user.password ).digest( 'hex' );

    return user.save();
} ).catch( err => console.error( err ) );
