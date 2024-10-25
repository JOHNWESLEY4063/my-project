// Required dependencies

const http = require('http');

const fs = require('fs');

const mongoose = require('mongoose');

const path = require('path');

const url = require('url');

// MongoDB connection

mongoose.connect('mongodb://127.0.0.1:27017/expense_tracker')

    .then(() => console.log('Database Connected'))

    .catch(err => console.error('Database connection error:', err));

// User Schema (Signup Schema)

const userSchema = new mongoose.Schema({

    username: { type: String, unique: true },

    phoneNumber: { type: String, unique: true },

    password: String

});

const UserModel = mongoose.model('users', userSchema);

// Create the server

const server = http.createServer((req, res) => {

    const parsedUrl = url.parse(req.url, true);

    const { pathname } = parsedUrl;

    // Serve the main page

    if (pathname === '/') {

        res.writeHead(200, { 'Content-Type': 'text/html' });

        fs.createReadStream(path.join(__dirname, 'cover.html')).pipe(res);

    }

    // Serve the Signup page

    else if (pathname === '/signup' && req.method === 'GET') {

        res.writeHead(200, { 'Content-Type': 'text/html' });

        fs.createReadStream(path.join(__dirname, 'signup.html')).pipe(res);

    }

    // Serve the Signin page

    else if (pathname === '/signin' && req.method === 'GET') {

        res.writeHead(200, { 'Content-Type': 'text/html' });

        fs.createReadStream(path.join(__dirname, 'signin.html')).pipe(res);

    }

    // Serve the Expense page

    else if (pathname === '/expense' && req.method === 'GET') {

        res.writeHead(200, { 'Content-Type': 'text/html' });

        fs.createReadStream(path.join(__dirname, 'expense.html')).pipe(res);

    }

    // Handle user signup API

    else if (pathname === '/api/signup' && req.method === 'POST') {

        let rawData = '';

        req.on('data', chunk => {

            rawData += chunk;

        });

        req.on('end', () => {

            const inputData = new URLSearchParams(rawData);

            // Attempt to save new user details

            UserModel.create({

                username: inputData.get('username'),

                phoneNumber: inputData.get('phoneNumber'),

                password: inputData.get('password')

            })

            .then(() => {

                res.writeHead(200, { 'Content-Type': 'text/html' });

                res.write('User registered successfully!');

                res.end();

            })

            .catch(err => {

                if (err.code === 11000) {

                    // Handle duplicate key error (username or phone number)

                    res.writeHead(400, { 'Content-Type': 'text/html' });

                    res.write('Username or phone number already exists. Please use a different one.');

                } else {

                    console.error('Error registering user:', err);

                    res.writeHead(500, { 'Content-Type': 'text/html' });

                    res.write('Error registering user.');

                }

                res.end();

            });

        });

    }

    // Serve other static files like CSS or images

    else {

        const filePath = path.join(__dirname, pathname);

        fs.access(filePath, fs.constants.F_OK, (err) => {

            if (!err) {

                const ext = path.extname(filePath).toLowerCase();

                const mimeType = ext === '.css' ? 'text/css' : 'text/html';

                res.writeHead(200, { 'Content-Type': mimeType });

                fs.createReadStream(filePath).pipe(res);

            } else {

                res.writeHead(404, { 'Content-Type': 'text/html' });

                res.write('404 Not Found');

                res.end();

            }

        });

    }

});

// Start the server

server.listen(8000, () => {

    console.log('Server started at http://localhost:8000');

});

