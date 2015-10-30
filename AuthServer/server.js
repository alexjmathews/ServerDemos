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


/*
 * Local Strategy Registration - generates UUID for account record
 * Unique Requires: email
 * Requires: username, firstName, lastName, admin
 * Optional: institution
 * Issues:
 * 	- Currently set to be verified by default
 *	- Need to verify data integrity
 */
app.post('/register', function(req,res) {
  //Data Verification
  var nEmail = req.body.email;
  var nUsername = req.body.username;
  var nFirstName = req.body.firstName;
  var nLastName = req.body.lastName;
  var nAdmin = req.body.admin;
  var nVerified = true;
  var nUUID = uuid.v4();
  console.log(nUsername);
  console.log(nLastName);
  console.log(nAdmin);
  console.log(nFirstName);

  if (!nEmail || !nUsername || ! nFirstName || !nLastName || typeof nAdmin === 'undefined') {
  	res.json({
  		success: false,
  		message: 'One or more required field was missing.'
  	})
  } else {
  	res.json({
  		success: true,
  		message: 'go on.'
  	})
  }

  
});


//   var lcUsername = req.body.username.toLowerCase();
//   var lcEmail = req.body.email.toLowerCase();
//   User.findOne({username: lcUsername}, function(err, uUser) {
//     if (err) throw err;

//     if (uUser) {
//       //Username taken
//       res.json({ 
//         success: false, 
//         message: 'Username Unavailable.' 
//       });
//     } else if (!uUser) {
//       User.findOne({email: lcEmail}, function(err, user) {
//         if (err) throw err;

//         if (user) {
//           //Username taken
//           res.json({ 
//             success: false, 
//             message: 'Email taken.' 
//           });
//         } else if (!user) {
//           //Username available, generate and save user
//           var userSalt = Math.random().toString(36).substr(2,10); 
//           var passHash = sha256(userSalt + req.body.password);
//           var nUser = new User({ 
//             username: lcUsername,
//             email: req.body.email, 
//             hash: passHash,
//             salt: userSalt,
//             instructor: false,
//             google: false
//           });

//           nUser.save(function(err) {
//             if (err) throw err;

//             res.json({
//               success: true,
//               message: 'New user created'
//             });
//           });
          
//         }
//       });
//     }

//   });
// });

id = uuid.v4();
console.log(id);
var testUser = new User({
    userID: 'jmar777',
    username: 'jmarasdf777',
	firstName: 'alex',
	lastName: 'mathews',
    institution: 'asdfasdfasdf asdfasdf',
    instructor: false,
    local: {
        email	: 'alexjmathews@yahoo.com',
	    hash	: 'asldfjkals;df', 
	    salt	: 'asdfsadfasdf', 
	    verified: true
    }
});

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