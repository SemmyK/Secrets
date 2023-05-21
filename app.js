require('dotenv').config()
const express = require('express')
const ejs = require('ejs')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
//const LocalStrategy = require('passport-local')

const PORT = process.env.PORT || 3000

//create express app
const app = express()
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))
app.set('view engine', 'ejs')

//create session
app.use(
	session({
		secret: process.env.SECRET_STRING,
		resave: false,
		saveUninitialized: false,
		cookie: {},
	})
)

//initialize passport
app.use(passport.initialize())
app.use(passport.session())

//set up mongoose
//create MongoDB database
const connectDB = async () => {
	try {
		const conn = await mongoose.connect(process.env.MONGO_URI)
		console.log(`MongoDB Connected: ${conn.connection.host}`)
	} catch (error) {
		console.log(error)
		process.exit(1)
	}
}

//create a SCHEMA that sets out the fields each document will have and their datatypes
const userSchema = new mongoose.Schema({
	email: {
		type: String,
		required: [true, 'No name specified!'],
	},
	password: {
		type: String,
		required: false,
	},
})
//add local mongoose to schema
userSchema.plugin(passportLocalMongoose, {
	usernameField: 'email',
	errorMessages: {
		IncorrectUsernameError: 'There is no account registered with that email',
	},
})

//create model from schema
const User = new mongoose.model('User', userSchema)

//create session for user

passport.use(User.createStrategy())
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

//requests to db and server

app.route('/').get((req, res) => {
	if (res.statusCode === 200) {
		res.render('home')
	} else {
		console.log('There was an error.')
	}
})

app
	.route('/login')
	.get((req, res) => {
		if (res.statusCode === 200) {
			res.render('login')
		} else {
			console.log('There was an error.')
		}
	})
	.post((req, res) => {
		if (res.statusCode === 200) {
			const username = req.body.username
			const password = req.body.password

			const alreadyUser = new User({
				email: username,
				password: password,
			})

			User.authenticate('local')(req, res, () => {
				req.logIn(alreadyUser, err => {
					if (err) {
						console.log(err)
					}
					res.redirect('/secrets')
				})
			})

			// req.logIn(alreadyUser, function (err) {
			// 	if (err) {
			// 		throw err
			// 	} else {
			// 		res.redirect('/secrets')
			// 	}
			// 	// session saved
			// })
		} else {
			console.log('There was an error while loging in user.')
		}
	})

app.route('/secrets').get((req, res) => {
	if (res.statusCode === 200) {
		if (req.isAuthenticated()) {
			res.render('secrets')
		} else {
			res.redirect('/login')
		}
	}
})

app.get('/logout', function (req, res, next) {
	req.logout(function (err) {
		if (err) {
			return next(err)
		}
		res.redirect('/')
	})
})

app
	.route('/register')
	.get((req, res) => {
		if (res.statusCode === 200) {
			res.render('register')
		} else {
			console.log('There was an error.')
		}
	})
	.post((req, res) => {
		if (res.statusCode === 200) {
			const username = req.body.username
			const password = req.body.password
			const newUser = new User({
				email: username,
			})
			User.register(newUser, password, (err, user) => {
				if (err) {
					console.log(err)
					res.redirect('/register')
				} else {
					User.authenticate('local')(req, res, () => {
						req.logIn(user, err => {
							if (err) {
								console.log(err)
							}
							res.redirect('/secrets')
						})
					})
				}
			})
		} else {
			console.log('There was an error while registering user.')
		}
	})

//Connect to the database before listening
connectDB().then(() => {
	app.listen(PORT, () => {
		console.log('listening for requests')
	})
})

// //find user that matches in db
// User.findOne({ email: username })
// 	.then(foundUser => {
// 		if (!foundUser) {
// 			console.log('No user found. User=' + username)
// 		} else {
// 			//check the password
// 			// Load hash from your password DB.
// 			bcrypt
// 				.compare(password, foundUser.password)
// 				.then(function (result) {
// 					if (result === true) {
// 						res.render('secrets')
// 					} else {
// 						console.log('User not found in Database.')
// 					}
// 				})
// 				.catch(err => {
// 					console.log(err)
// 				})
// 		}
// 	})
// 	.catch(err => {
// 		console.log(err)
// 	})
