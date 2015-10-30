// =======================
// get the packages we need ============
// =======================
var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var sha256 = require('js-sha256');
var cors = require('cors');
var request = require('request');

var jwt    = require('jsonwebtoken'); 
var config = require('./config'); 
var User   = require('./app/models/user'); 
    
// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
mongoose.connect(config.database); // connect to database
app.set('jwtSecret', config.secret); // get secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));


app.use(cors());
///need to configure cors!!!!!!! ////////////

// =======================
// routes ================
// =======================
// basic route


app.get('/', function(req, res) {
  res.send('Hello! The Auth API is at http://localhost:' + port + '/api');
});

// API ROUTES -------------------

app.post('/register', function(req,res) {
  //First check if Username is available
  /////// need to confirm all data is there Error will be thrown now!!!!!!!!!!!
  /////// need to verify data integrity
  var lcUsername = req.body.username.toLowerCase();
  var lcEmail = req.body.email.toLowerCase();
  User.findOne({username: lcUsername}, function(err, uUser) {
    if (err) throw err;

    if (uUser) {
      //Username taken
      res.json({ 
        success: false, 
        message: 'Username Unavailable.' 
      });
    } else if (!uUser) {
      User.findOne({email: lcEmail}, function(err, user) {
        if (err) throw err;

        if (user) {
          //Username taken
          res.json({ 
            success: false, 
            message: 'Email taken.' 
          });
        } else if (!user) {
          //Username available, generate and save user
          var userSalt = Math.random().toString(36).substr(2,10); 
          var passHash = sha256(userSalt + req.body.password);
          var nUser = new User({ 
            username: lcUsername,
            email: req.body.email, 
            hash: passHash,
            salt: userSalt,
            instructor: false,
            google: false
          });

          nUser.save(function(err) {
            if (err) throw err;

            res.json({
              success: true,
              message: 'New user created'
            });
          });
          
        }
      });
    }

  });
});


app.post('/google-register', function(req,res) {
  //First check if Username is available
  /////// need to confirm all data is there Error will be thrown now!!!!!!!!!!!
  /////// need to verify data integrity
  var lcUsername = req.body.username.toLowerCase();
  var googToken = req.body.googToken;

  console.log("touched google authenticate");
  var concat = "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + googToken;
  console.log(concat);
  request(concat, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var theBody = JSON.parse(body);
      var lcEmail = theBody.email.toLowerCase();
      console.log(theBody);  
      User.findOne({username: lcUsername}, function(err, uUser) {
        if (err) throw err;

        if (uUser) {
          //Username taken
          res.json({ 
            success: false, 
            message: 'Username Unavailable.' 
          });
        } else if (!uUser) {
          User.findOne({email: lcEmail}, function(err, user) {
            if (err) throw err;

            if (user) {
              //Username taken
              res.json({ 
                success: false, 
                message: 'Email already registered.' 
              });
            } else if (!user) {
              //Username available, generate and save user
              var nUser = new User({ 
                username: lcUsername,
                email: lcEmail, 
                hash: "",
                salt: "",
                instructor: false,
                google: true
              });

              nUser.save(function(err) {
                if (err) throw err;

                res.json({
                  success: true,
                  message: 'New user created'
                });
              });
              
            }
          });
        }
      });
    }
  });
});

var apiRoutes = express.Router(); 

apiRoutes.post('/google-authenticate', function(req, res) {
  // find the user
  var googToken = req.body.googToken;
  console.log("touched google authenticate");
  var concat = "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + googToken;
  console.log(concat);
  request(concat, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var theBody = JSON.parse(body);
      var lcEmail = theBody.email.toLowerCase();
      console.log(theBody);
      User.findOne({
        email: lcEmail
      }, function(err, user) {
        if (err) throw err;

        if (!user) {
          res.json({ success: false, message: 'Authentication failed. User not found.' });
        } else if (user) {

          var tokenBody = {
            username : user.username,
            info: 'extra token info would go here'
          };

          var token = jwt.sign(tokenBody, app.get('jwtSecret'), {
            algorithm: "HS256", 
            expiresIn: 1800
          });

          // return the information including token as JSON
          res.json({
            success: true,
            username: user.username,
            message: 'Token for Authorization',
            token: token
          });
            

        }

      });
    }
  })
});

apiRoutes.post('/authenticate', function(req, res) {
  // find the user
  var lcEmail = req.body.email.toLowerCase();
  User.findOne({
    email: lcEmail
  }, function(err, user) {
    if (err) throw err;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user.google) {
      res.json({ success: false, message: 'Authentication failed. You logged in through google.' });
    }
    else if (user) {

      // check if password matches
      var passHash = sha256(user.salt + req.body.password);
      if (user.hash != passHash) {
        res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      } else {
        // if user is found and password is right
        // create a token
        var tokenBody = {
          username : user.username,
          info: 'extra token info would go here'
        };

        var token = jwt.sign(tokenBody, app.get('jwtSecret'), {
          algorithm: "HS256", 
          expiresIn: 1800
        });

        // return the information including token as JSON
        res.json({
          success: true,
          username: user.username,
          message: 'Token for Authorization',
          token: token
        });
      }   

    }

  });
});


//authentication middleware here
apiRoutes.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, app.get('jwtSecret'), function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: err.message });    
      } else {
        // if everything is good, save to request for use in other routes
        req.tokenBodyDecoded = decoded;    
        req.username = decoded.username;
        req.info = decoded.info;
        next();
      }
    });

  } else {
    // if there is no token
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });
    
  }
});

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function(req, res) {
	console.log("User request from" + req.username);
  res.json({ message: 'Welcome to the API' , 
  			username: req.username, info: req.info});
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users);
  });
});   



// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

// =======================
// start the server ======
// =======================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);


