// ### Required Packages
var express     = require('express');
var app         = express();
var mongoose    = require('mongoose');
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var cors 		= require('cors');
var sha256 		= require('js-sha256');
var uuid		= require('uuid');
var config 		= require('./config'); 


// ### Setting up various variables
var port = config.port; 
mongoose.connect(config.database); 
app.set('jwtSecret', config.jwtSecret); 
//Ensuring input in correct format
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
//Logging
app.use(morgan('dev'));
//Allow Cross origin
app.use(cors());
///need to configure cors!!!!!!! ////////////!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
var User = require('./app/models/user'); 


// ###Routes ----------------------------------------------------------------------
app.get('/', function(req, res) {
	var userSalt = Math.random().toString(36).substr(2,10);
	res.send('Hello! The Auth API is at http://localhost:' + port + userSalt);
});

app.get('/all-users', function(req, res) {
  User.find({}, function(err, users) {
    if (err) throw err;

    // object of all the users
    console.log(users);
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
app.post('/local-register', function(req,res) {
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
      optionalFields: 'institution'
    })
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
        console.log(existingLocalUser);
      } else {
        //check if google user already exists
        User.findOne({'google.email': nEmail}, function(err, existingGoogleUser) { 
          if (err) throw err;

          if (existingGoogleUser) {
            res.json({
              success: false,
              message: 'Google account already in use. Please log in through Google.'
            });
            console.log(existingGoogleUser);
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
                verified: true
              }
            });

            nUser.save(function(err) {
              if (err) throw err;

              res.json({
                success: true,
                message: 'New user created'
              });
            });//user save
          }
        });//google find
      }
    });//local find
  }  
});//local registration

/*
 * Switches string to Title Case formatting. User for correcting capitalization for names.
 */
function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/*
 * Validates email formatting.
 */
function validEmail(email) {
    var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return re.test(email);
}





id = uuid.v4();
console.log(id);


//Find Methods
// User.find({'local.email': 'alexmathews@yahoo.com'}, function(err, users) {
//   if (err) throw err;

//   // object of all the users
//   console.log(users);
// });

// User.find({}, function(err, users) {
//   if (err) throw err;

//   // object of all the users
//   console.log(users);
// });


//Run Server
app.listen(port);
console.log('Magic happens at http://localhost:' + port);