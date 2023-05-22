require('dotenv').config()
const express = require('express')
const ejs = require('ejs')
const bodyParser = require('body-parser')
const session = require('express-session')
//mongoose
const mongoose = require('mongoose')
//passport
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const LocalStrategy = require('passport-local').Strategy
const GoogleStrategy = require('passport-google-oauth20').Strategy
const FacebookStrategy = require('passport-facebook').Strategy
const PORT = process.env.PORT || 3000

//create and configure express app
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
	googleId: {
		type: String,
		required: false,
	},
	facebookId: {
		type: String,
		required: false,
	},
	email: {
		type: String,
		required: false,
	},
	name: {
		type: String,
		required: false,
	},
	password: {
		type: String,
		required: false,
	},
	secrets: [],
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

// Configure Passport to use the LocalStrategy for local authentication
passport.use(new LocalStrategy(User.authenticate()))
// Configure Passport to use the GoogleStrategy for Google OAuth
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: 'http://localhost:3000/auth/google/secrets',
			state: true,
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				// Find or create the user in your database
				const user = await User.findOne({
					googleId: profile.id,
					name: profile.displayName,
				})

				if (user) {
					done(null, user)
				} else {
					const newUser = await User.create({
						googleId: profile.id,
						name: profile.displayName,
					})
					done(null, newUser)
				}
			} catch (error) {
				done(error, null)
			}
		}
	)
)

// Configure Passport to use the FacebookStrategy for Facebook OAuth
passport.use(
	new FacebookStrategy(
		{
			clientID: process.env.FACEBOOK_CLIENT_ID,
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
			callbackURL: 'http://localhost:3000/auth/facebook/secrets',
			profileFields: ['id', 'displayName', 'email'],
		},
		async (accessToken, refreshToken, profile, done) => {
			console.log(profile)
			try {
				// Find or create the user in your database
				const user = await User.findOne({ facebookId: profile.id })

				if (user) {
					done(null, user)
				} else {
					const newUser = await User.create({
						facebookId: profile.id,
						name: profile.displayName,
					})
					done(null, newUser)
				}
			} catch (error) {
				done(error, null)
			}
		}
	)
)

// Serialize and deserialize user instances to and from the session
passport.serializeUser(function (user, done) {
	done(null, user.id)
})
passport.deserializeUser(async (id, done) => {
	try {
		const user = await User.findById(id)

		done(null, user)
	} catch (error) {
		done(error, null)
	}
})

//requests to db and server

app.route('/').get((req, res) => {
	if (res.statusCode === 200) {
		res.render('home')
	} else {
		console.log('There was an error.')
	}
})

// Google OAuth route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }))

// Google OAuth callback route
app.get(
	'/auth/google/secrets',
	passport.authenticate('google', { failureRedirect: '/login' }),
	(req, res) => {
		res.redirect('/secrets') // Redirect to the home page after successful authentication
	}
)

// Facebook OAuth routes
app.get('/auth/facebook', passport.authenticate('facebook'))

app.get(
	'/auth/facebook/secrets',
	passport.authenticate('facebook', { failureRedirect: '/login' }),
	(req, res) => {
		res.redirect('/secrets')
	}
)

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

			//check if user already registered
			//find user that matches in db
			User.findOne({ email: alreadyUser.email })
				.then(foundUser => {
					if (!foundUser) {
						console.log('No user found. User=' + username)
						res.redirect('/register')
					} else {
						passport.authenticate('local', {
							successRedirect: '/secrets',
							failureRedirect: '/login',
						})
						User.authenticate('local')(req, res, () => {
							req.logIn(foundUser, err => {
								if (err) {
									console.log(err)
								}
								if (req.isAuthenticated()) {
									res.redirect('/secrets')
								} else {
									console.log('Error in authentication.')
								}
							})
						})
					}
				})
				.catch(err => {
					console.log(err)
				})
		} else {
			console.log('There was an error while loging in user.')
		}
	})

app.route('/secrets').get((req, res) => {
	if (res.statusCode === 200) {
		if (req.isAuthenticated()) {
			let secretsArr = []
			//find users with secrets and show those secrets
			User.find({ secrets: { $ne: [] } }).then(foundSecrets => {
				foundSecrets.forEach(user => {
					user.secrets.forEach(secret => {
						secretsArr.push(secret)
					})
				})
				if (secretsArr.length !== 0) {
					res.render('secrets', { secrets: secretsArr })
				} else {
					res.render('secrets', { secrets: ['Secret 0'] })
				}
			})
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

			//check if user already registered
			//find user that matches in db
			User.findOne({ email: username })
				.then(foundUser => {
					if (!foundUser) {
						console.log('No user found. User=' + username)
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
						console.log('User already registered')
						res.redirect('/login')
					}
				})
				.catch(err => {
					console.log(err)
				})
		} else {
			console.log('There was an error while registering user.')
		}
	})

app
	.route('/submit')
	.get((req, res) => {
		if (res.statusCode === 200) {
			if (req.isAuthenticated()) {
				res.render('submit')
			} else {
				res.redirect('/login')
			}
		}
	})
	.post((req, res) => {
		if (res.statusCode === 200) {
			const submittedSecret = req.body.secret

			User.findById(req.user.id)
				.then(foundUser => {
					if (!foundUser) {
						console.log('No user found.')
					} else {
						foundUser.secrets.push(submittedSecret)
						foundUser.save()
						res.redirect('/secrets')
					}
				})
				.catch(err => {
					console.log(err)
				})
		}
	})
//Connect to the database before listening
connectDB().then(() => {
	app.listen(PORT, () => {
		console.log('listening for requests')
	})
})
