//jshint esversion:6
require('dotenv').config()
const express = require('express')
const ejs = require('ejs')
const mongoose = require('mongoose')
var encrypt = require('mongoose-encryption')
const PORT = process.env.PORT || 3000

const app = express()
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.set('view engine', 'ejs')

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
		required: [true, 'No body specified!'],
	},
})

const secret = process.env.SECRET_STRING

userSchema.plugin(encrypt, { secret: secret, encryptedFields: ['password'] })

//create model from schema
const User = new mongoose.model('User', userSchema)

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

			//find user that matches in db
			User.findOne({ email: username })
				.then(foundUser => {
					if (!foundUser) {
						console.log('No user found. User=' + username)
					} else {
						if (foundUser.password === password) {
							//show secrets
							res.render('secrets')
						}
					}
				})
				.catch(err => {
					console.log(err)
				})
		} else {
			console.log('There was an error while loging in user.')
		}
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
			const newUser = new User({
				email: req.body.username,
				password: req.body.password,
			})

			newUser.save()
			res.render('secrets')
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
