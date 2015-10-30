var mongoose = require('mongoose');
var Schema = mongoose.Schema;


//Defining User Schema
var UserSchema = new Schema(
	{ 
		userID: { type: String, required: true, index: { unique: true } },
		username: String,
		firstName: String,
		lastName: String,
	    institution: String,
	    instructor: Boolean,
		local: {
	        email	: String,
		    hash	: String, 
		    salt	: String,
		    verified: Boolean
	    },
		google: {
	        email	: String,
	        gID		: String
	    }
	}
);

module.exports = mongoose.model('User', UserSchema);