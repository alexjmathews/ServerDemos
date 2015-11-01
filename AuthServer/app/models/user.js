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
	        email			: String,
		    hash 			: String, 
		    salt			: String,
		    verified 		: Boolean,
	    	isForgotten 	: Boolean, 
	    	forgottenID 	: String,
	    	forgottenSecret : String
	    },
		google: {
	        email	: String
	    }
	}
);

module.exports = mongoose.model('User', UserSchema);