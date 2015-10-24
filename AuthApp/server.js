// =======================
// get the packages we need ============
// =======================
var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var sha256 = require('js-sha256');

var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User   = require('./app/models/user'); // get our mongoose model
    
// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
mongoose.connect(config.database); // connect to database
app.set('jwtSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// =======================
// routes ================
// =======================
// basic route
app.get('/', function(req, res) {
    res.send('Hello! The API is at http://localhost:' + port + '/api');
});

// API ROUTES -------------------
// we'll get to these in a second

app.post('/signup', function(req,res) {
  //First check if Username is available
  User.findOne({
    username: req.body.username
  }, function(err, user) {
    if (err) throw err;

    if (user) {
      //Username taken
      res.json({ 
        success: false, 
        message: 'Username Unavailable.' 
      });
    } else if (!user) {
      //Username available, generate and save user
      var userSalt = Math.random().toString(36).substr(2,10); 
      var passHash = sha256(userSalt + req.body.password);
      var nUser = new User({ 
        username: req.body.username,
        email: req.body.email, 
        hash: passHash,
        salt: userSalt,
        admin: true 
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
});

var apiRoutes = express.Router(); 

apiRoutes.post('/test', function(req,res) {
  res.json({
    success: true,
    message: 'Hello from test'
  });
});

// TODO: route to authenticate a user (POST http://localhost:8080/api/authenticate)

// TODO: route middleware to verify a token
// route to authenticate a user (POST http://localhost:8080/api/authenticate)
apiRoutes.post('/authenticate', function(req, res) {
  // find the user
  User.findOne({
    username: req.body.username
  }, function(err, user) {
    if (err) throw err;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user) {

      // check if password matches
      var passHash = sha256(user.salt + req.body.password);
      if (user.hash != passHash) {
        res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      } else {
        // if user is found and password is right
        // create a token
        var tokenBody = {
          username : req.body.username,
          info: 'extra token info would go here'
        };

        var token = jwt.sign(tokenBody, app.get('jwtSecret'), {
          algorithm: "HS256", 
          expiresIn: 30
        });

        // return the information including token as JSON
        res.json({
          success: true,
          message: 'Token for Authorization',
          token: token
        });
      }   

    }

  });
});

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


