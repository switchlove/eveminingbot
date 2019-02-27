var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our fleet model
var userSchema = mongoose.Schema({
	fleet_name : {
		type: String
	},
	is_free_move : {
		type: String
	},
	is_registered : {
		type: String
	},
	is_voice_enabled : {
		type: String
	},
	motd : {
		type : String
	},
	refreshToken : {
		type : String
	}
});

// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('Fleet', userSchema);

