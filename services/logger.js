var {Log}=require('./database');

class Logger {
	static write ( action, user, callback ) {
    	new Log( {
        	action: action,
          	// Isto é para o caso em que algum log é escrito quando alguém não tem sessão iniciada, guarda o user a null
          	//eu esqueço-me sempre que isto é um if then else em C
          	// sim, e em JS funciona da mesma maneira, portanto ou retorna null ou { ... }
            user: user == null ? null : {
            	_id: user._id,
              	username: user.username
            }
        } ).save( err => {
        	// Agora, o argumento callback vai ser opcional: a maioria das vezes, se escrever o log der erro, nós só queremos
          	// imprimir o erro para a consola mas deixar a aplicação continuar a funcionar
          	// Por isso a menos que o programador introduza um callback, ele executa esse comportamento por defeito
          	if ( callback ) {
              	callback( err );
            } else if ( err ) {
            	console.error( err );
            }
        } );
    }

  	// Agora em qualquer lado que quisermos criar um log é muito mais simples
  	//// Logger.write( "Package inserido", req.user );
	// Done
    //ok
}

module.exports = { Logger };
