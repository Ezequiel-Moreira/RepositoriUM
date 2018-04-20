var passport=require('passport');
var LocalStrategy=require('passport-local').Strategy;
var { User } = require( '../services/database' );

class Login {
  	static setup ( passport ) {

      passport.serializeUser( ( user, done ) => {
      	done( null, user.username );
      });

      passport.deserializeUser( ( username, done ) => {
        User.findOne({ username: username }, (err, user) => {
          if(err){return done(err);}
          done( null, user );
        });
      });

  		passport.use(new LocalStrategy(
        (username,password,done)=>{
          //Versão b)usando mongodb
          User.findOne({ username: username }, (err, user) => {
            if (err) { return done(err); }
            if (!user) {
              return done(null, false, { message: 'Incorrect username.' });
            }
            if (password!=user.password) {
              return done(null, false, { message: 'Incorrect password.' });
            }
            return done(null, user);
            });
      }));

  }
}

module.exports=Login;
