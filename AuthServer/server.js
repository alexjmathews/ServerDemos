/*
 * AuthServer - an authentication server managing both local and google strategies
 * Notes:
 *  - All tokens last for 30 minutes currently to test expiration 
 * Issues:
 *  - Get rid of users route - unsafe as hell LOL 
 */


// ### Required Packages
var express     = require('express');
var app         = express();
var mongoose    = require('mongoose');
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var cors        = require('cors');
var sha256      = require('js-sha256');
var jwt         = require('jsonwebtoken'); 
var uuid        = require('uuid');
var config      = require('./config'); 
var request     = require('request');
var events      = require('events');
var emitter     = new events.EventEmitter();

// ### Setting up various variables
var port = config.port; 
mongoose.connect(config.authDatabase); 
app.set('jwtSecret', config.jwtSecret); 
app.set('tokenExpiration', config.tokenExpiration);
app.set('googleAuthURLBase', config.googleAuthURLBase);
app.set('forgottenIDExpiration', config.forgottenIDExpiration);
//Ensuring input in correct format
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
//Logging
app.use(morgan('dev'));
//Allow Cross origin
app.use(cors());
///need to configure cors!!!!!!! ////////////!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
var User = require('./app/models/user'); 
var apiRoutes = express.Router(); 

// ###Routes ----------------------------------------------------------------------
app.get('/', function(req, res) {
	var userSalt = Math.random().toString(36).substr(2,10);
	res.send('Hello! The Auth API is at http://localhost:' + port + userSalt);
});

app.get('/all-users', function(req, res) {
  User.find({}, function(err, users) {
    if (err) throw err;

    // object of all the users
    res.json(
      users
    );

  });
});

/*
 * Local Strategy Registration - generates UUID for account record
 * Unique Requires: email
 * Requires: username, firstName, lastName, instructor, password
 * Optional: institution
 * Issues:
 * 	- Currently set to be verified by default
 *	- Need to verify data integrity 
 *    + fields confirmed to exist except insitution 
 *    + email validated, names titlecased
 */
apiRoutes.post('/local/register', function(req,res) {
  //Data Verification
  var nEmail = req.body.email;
  var nUsername = req.body.username;
  var nFirstName = req.body.firstName;
  var nLastName = req.body.lastName;
  var nInstructor = req.body.instructor;
  var nPassword = req.body.password;
  var nVerified = true;
  var nUUID = uuid.v4();

  if (!nEmail || !nUsername || ! nFirstName || !nLastName || !nPassword || typeof nInstructor === 'undefined') {
    res.json({
      success: false,
      message: 'One or more required field was missing.',
      requiredFields: 'email:str (unique), username:str, firstName:stf, lastName:str, password:str, instructor:bool',
      optionalFields: 'institution:str'
    });
  } else if (!validEmail(nEmail)) {
    res.json({
      success: false,
      message: 'Email invalid.'
    });
  } else {
    //all fields confirmed, adjust case 
    nEmail = nEmail.toLowerCase();
    nUsername = nUsername.toLowerCase();
    nFirstName = toTitleCase(nFirstName);
    nLastName = toTitleCase(nLastName);

    //check if local user already exists
    User.findOne({'local.email': nEmail}, function(err, existingLocalUser) {
      if (err) throw err;
      
      if (existingLocalUser) {
        res.json({
          success: false,
          message: 'Email already in use.'
        });
      } else {
        //check if google user already exists
        User.findOne({'google.email': nEmail}, function(err, existingGoogleUser) { 
          if (err) throw err;

          if (existingGoogleUser) {
            res.json({
              success: false,
              message: 'Google account already in use. Please log in through Google.'
            });
          } else {
            //No existing user ... create account
            var userSalt = Math.random().toString(36).substr(2,10); 
            var passHash = sha256(userSalt + nPassword);
            var nUser = new User({
              userID: nUUID,
              username: nUsername,
              firstName: nFirstName,
              lastName: nLastName,
              institution: req.body.institution,
              instructor: nInstructor,
              local: {
                email : nEmail,
                hash  : passHash, 
                salt  : userSalt, 
                verified: true,
                isForgotten: false,
                forgottenID   : '',
                forgottenSecret : ''
              }
            });

            nUser.save(function(err) {
              if (err) throw err;

              res.json({
                success: true,
                message: 'New user created.'
              });
            });//user save
          }
        });//google find
      }
    });//local find
  }  
});//local registration

/*
 * Authentication via local strategy.
 * Requires: email, password
 * Issues:
 *  - if forgotten then on authentication clearly not forgotten
 */
apiRoutes.post('/local/authenticate', function(req,res) {
  var candidateEmail = req.body.email;
  var candidatePassword = req.body.password;
  if (!candidateEmail || !candidatePassword) {
    res.json({
      success: false,
      message: 'One or more required field was missing.',
      requiredFields: 'email:str, password:str'
    });
  } else if (!validEmail(candidateEmail)) {
    res.json({
      success: false,
      message: 'Email invalid.'
    });
  } else {
    User.findOne({'local.email': candidateEmail}, function(err, localUser) {
      if (err) throw err;
      
      if (!localUser) {
        User.findOne({'google.email': candidateEmail}, function(err, googleUser) {
          if (googleUser) {
            res.json({
              success: false,
              message: 'Please log in using Google.'
            });
          } else {
            res.json({
              success: false,
              message: 'User does not exist.'
            });
          }
        });
      } else {
        var passHash = sha256(localUser.local.salt + candidatePassword);
        if (localUser.local.hash != passHash) {
          res.json({
            success: false,
            message: 'Incorrect password.'
          });
        } else {
          var tokenBody = {
            username  : localUser.username,
            uuid      : localUser.uuid, 
            info      : 'extra token info would go here'
          };

          var token = jwt.sign(tokenBody, app.get('jwtSecret'), {
            algorithm: "HS256", 
            expiresIn: app.get('tokenExpiration')
          });
          if (localUser.local.isForgotten) {
            localUser.local.isForgotten = false;
            localUser.local.forgottenID = '';
            localUser.local.forgottenSecret = '';
            localUser.save(function(err) {
              if (err) throw err;
            });
          } 
          //return the information including token as JSON
          res.json({
            success     : true,
            username    : localUser.username,
            firstName   : localUser.firstName,
            lastName    : localUser.lastName,
            message     : 'Token for Authorization',
            token       : token
          });
        }
      }
    }); //local search
  }
});


/*
 * Local Strategy Forgot - begins forgotten password workflow
 * Fogotten password strategy expires in time set in config file
 * Requires: email
 */
apiRoutes.post('/local/forgot', function(req,res) {
  var candidateEmail = req.body.email;
  if (!candidateEmail) {
    res.json({
      success: false,
      message: 'One required field was missing.',
      requiredFields: 'email:str'
    });
  } else if (!validEmail(candidateEmail)) {
    res.json({
      success: false,
      message: 'Email invalid.'
    });
  } else {
    User.findOne({'local.email': candidateEmail}, function(err, localUser) {
      //verify that account exists
      if (err) throw err;
      
      if (!localUser) {
        //ensure user is not trying to reset password on a google strategy account
        User.findOne({'google.email': candidateEmail}, function(err, googleUser) {
          if (googleUser) {
            res.json({
              success: false,
              message: 'Email was registered through Google. Log in with Google'
            });
          } else {
            res.json({
              success: false,
              message: 'User does not exist.'
            });
          }
        });//check if google account under same email
      } else {
        localUser.local.isForgotten = true;
        localUser.local.forgottenID = uuid.v1();
        localUser.save(function(err) {
          if (err) throw err;

          //send an email with id in link here

          var forgottenSecret = Math.random().toString(36).substr(2,10); 
          localUser.local.forgottenSecret = forgottenSecret;
          localUser.save(function(err) {
            if (err) throw err;
            
            setTimeout(function () {
              emitter.emit('forgottenIDExpired', localUser.local.forgottenID);
            }, app.get('forgottenIDExpiration'));
            res.json({
              success: true,
              forgottenSecret: forgottenSecret,
              message: 'Forgotten password workflow started. Secret attached'
            });
          });//save forgotten secret
        });//save forgotten state
      }
    });//check for local user under email
  }
});//local forgotten password workflow


/*
 * Listener for expired forgottenID's
 * Clears forgotten information schema's local strategy
 */
emitter.on('forgottenIDExpired', function(forgottenID)
{
    User.findOne({'local.forgottenID': forgottenID}, function(err, localUser) {
      if (err) throw err;
      
      if (localUser) {
        localUser.local.isForgotten = false;
        localUser.local.forgottenID = '';
        localUser.local.forgottenSecret = '';
        localUser.save(function(err) {
          if (err) throw err;
        });
      }
    });
});


/*
 * Local Strategy Reset - resets password using secret and ID
 * Requires: forgottenID, forgottenSecret, password
 */
apiRoutes.post('/local/reset/', function(req, res) {
  var candidateID = req.body.forgottenID;
  var candidateSecret = req.body.forgottenSecret;
  var candidatePassword = req.body.password;
  if (!candidateID || !candidateSecret || !candidatePassword) {
    res.json({
      success: false,
      message: 'One or more required field was missing.',
      requiredFields: 'forgottenID:str, forgottenSecret:str, password:str'
    });
  } else {
    User.findOne({'local.forgottenID': candidateID}, function(err, localUser) {
      if (err) throw err;
      
      if (!localUser) { 
        res.json({
          success: false,
          message: 'forgottenID was invalid'
        });
      } else {
        if (localUser.local.forgottenSecret != candidateSecret) {
          res.json({
            success: false,
            message: 'forgottenSecret was invalid.'
          });
        } else {
          var userSalt = Math.random().toString(36).substr(2,10); 
          var passHash = sha256(userSalt + candidatePassword);
          localUser.local.salt = userSalt;
          localUser.local.hash = passHash;
          localUser.local.forgottenSecret = '';
          localUser.local.forgottenID = '';
          localUser.local.isForgotten = false;
          localUser.save(function(err) {
            if (err) throw err;

            res.json({
              success: true,
              message: 'Password Reset'
            });
          });
        }
      }
    });
  }
});

//------------------------------Google Strategy--------------------------------------

/*
 * Google Strategy Registration - generates UUID for account record
 * Unique Requires: googleToken
 * Requires: username, instructor
 * Optional: institution
 * Issues:
 */
apiRoutes.post('/google/register', function(req,res) {

  //Data Verification
  var nGoogleToken = req.body.googleToken;
  var nUsername = req.body.username;
  var nInstructor = req.body.instructor;
  var nUUID = uuid.v4();

  if (!nGoogleToken || !nUsername || typeof nInstructor === 'undefined') {
    res.json({
      success: false,
      message: 'One or more required field was missing.',
      requiredFields: 'googleToken:str, username:str, instructor:bool',
      optionalFields: 'institution:str'
    });
  } else {
    //Use google token to request more information
    var concat = app.get('googleAuthURLBase') + nGoogleToken;
    request(concat, function (error, response, body) {
      if (!error && response.statusCode == 200) { 
        //Parse google response 
        var googleAuthBody = JSON.parse(body);
        var nEmail      = googleAuthBody.email;
        //Split name from google
        var nFirstName  = googleAuthBody.name.split(' ').slice(0, -1).join(' ');
        var nLastName   = googleAuthBody.name.split(' ').slice(-1).join(' ');;
        //check for existing google account
        User.findOne({'google.email': nEmail}, function(err, existingGoogleUser) {
          if (err) throw err;

          if (existingGoogleUser) {
            res.json({
              success: false,
              message: 'Google account already in use. Please log in with Google.'
            });
          } else {
            //check for existing local account under same email
            User.findOne({'local.email': nEmail}, function(err, existingLocalUser) {
              if(existingLocalUser) {
                res.json({
                  success: false,
                  message: 'Email associated with the account already in use. Please log in normally.'
                });
              } else {
                //Everything verified, generate new user via Google
                var nUser = new User({
                  userID: nUUID,
                  username: nUsername,
                  firstName: nFirstName,
                  lastName: nLastName,
                  institution: req.body.institution,
                  instructor: nInstructor,
                  google: {
                    email : nEmail
                  }
                });
                nUser.save(function(err) {
                  if (err) throw err;

                  res.json({
                    success: true,
                    message: 'New user created via Google.'
                  });
                });//user save
              }
            });//existing local check
          }
        });//existing google check
      } else {
        res.json({
          success     : false,
          message     : 'Error authenticating with Google.'
        });
      }
    });//google request
  }
});//google registration


/*
 * Google Strategy Registration - generates UUID for account record
 * Unique Requires: googleToken
 * Requires: username, instructor
 * Optional: institution
 * Issues:
 *  -check for local strategy before saying no user available
 */
apiRoutes.post('/google/authenticate', function(req,res) { 
  var candidateGoogleToken = req.body.googleToken;
  if (!candidateGoogleToken) {
    res.json({
      success: false,
      message: 'Required field was missing.',
      requiredFields: 'googleToken:str'
    });
  } else {
    //Use google token to request more information
    var concat = app.get('googleAuthURLBase') + candidateGoogleToken;
    request(concat, function (error, response, body) {
      if (!error && response.statusCode == 200) { 
        //Parse google response 
        var googleAuthBody      = JSON.parse(body);
        var candidateEmail      = googleAuthBody.email;

        User.findOne({'google.email': candidateEmail}, function(err, googleUser) {
          if (err) throw err;

          if (googleUser) {
            var tokenBody = {
              username  : googleUser.username,
              uuid      : googleUser.uuid, 
              info      : 'extra token info would go here'
            };

            var token = jwt.sign(tokenBody, app.get('jwtSecret'), {
              algorithm: "HS256", 
              expiresIn: app.get('tokenExpiration') 
            });
            //return the information including token as JSON
            res.json({
              success     : true,
              username    : googleUser.username,
              firstName   : googleUser.firstName,
              lastName    : googleUser.lastName,
              message     : 'Token for Authorization',
              token       : token
            });
          } else {
            //Check local for existing account
            User.findOne({'local.email': candidateEmail}, function(err, existingLocalUser) {
              if(existingLocalUser) {
                res.json({
                  success: false,
                  message: 'Email associated with the account already in use. Please log in normally.'
                });
              } else { 
                res.json({
                  success: false,
                  message: 'User does not exist. Please register.'
                });
              }
            });//check for a local user
          }
        });//check database for google user
      }
    });//request information from Google
  }
});//google authentication


/*
 * Switches string to Title Case formatting. User for correcting capitalization for names.
 */
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/*
 * Validates email formatting.
 */
function validEmail(email) {
    var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return re.test(email);
}

// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

//Run Server
app.listen(port);
console.log('Magic happens at http://localhost:' + port);