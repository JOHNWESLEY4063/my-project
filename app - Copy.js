const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection with retry logic
const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb://127.0.0.1:27017/task-master', {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        setTimeout(connectDB, 5000);
    }
};

connectDB();

// User Schema
const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: [true, 'Username is required'],
        unique: true,
        trim: true
    },
    phoneNumber: { 
        type: String, 
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true
    },
    password: { 
        type: String, 
        required: [true, 'Password is required']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);

// Task Schema
const taskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: { 
        type: String, 
        required: [true, 'Task title is required'],
        trim: true,
        maxLength: [100, 'Title cannot be more than 100 characters']
    },
    description: { 
        type: String, 
        required: [true, 'Task description is required'],
        trim: true,
        maxLength: [500, 'Description cannot be more than 500 characters']
    },
    status: { 
        type: String, 
        enum: {
            values: ['pending', 'ongoing', 'done'],
            message: '{VALUE} is not a valid status'
        },
        default: 'pending'
    },
    priority: {
        type: String,
        enum: {
            values: ['low', 'medium', 'high'],
            message: '{VALUE} is not a valid priority'
        },
        default: 'medium'
    },
    dueDate: {
        type: Date,
        required: [true, 'Due date is required'],
        validate: {
            validator: function(value) {
                return value >= new Date(new Date().setHours(0, 0, 0, 0));
            },
            message: 'Due date cannot be in the past'
        }
    },
    createdDate: { 
        type: Date, 
        default: Date.now 
    },
    lastModified: {
        type: Date,
        default: Date.now
    }
});

// Update lastModified on save
taskSchema.pre('save', function(next) {
    this.lastModified = new Date();
    next();
});

const Task = mongoose.model('Task', taskSchema);

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    if (err instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation Error',
            details: Object.values(err.errors).map(e => e.message)
        });
    }

    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid data format'
        });
    }

    if (err.name === 'MongoServerError' && err.code === 11000) {
        return res.status(409).json({
            status: 'error',
            message: 'Duplicate entry found'
        });
    }

    res.status(500).json({
        status: 'error',
        message: 'Internal Server Error'
    });
};

// Auth Routes
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});

app.post('/api/signup', async (req, res, next) => {
    try {
        const { username, phoneNumber, password } = req.body;
        
        const user = new User({
            username,
            phoneNumber,
            password // Note: In a real application, you should hash the password
        });

        await user.save();
        
        res.status(201).json({
            status: 'success',
            message: 'User registered successfully'
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/signin', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username });
        
        if (!user || user.password !== password) { // Note: In a real application, you should compare hashed passwords
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Login successful',
            userId: user._id
        });
    } catch (err) {
        next(err);
    }
});

// Task Routes
app.post('/api/tasks', async (req, res, next) => {
    try {
        const taskData = {
            userId: req.body.userId, // Add user ID to associate task with user
            title: req.body.title,
            description: req.body.description,
            status: req.body.status,
            priority: req.body.priority,
            dueDate: new Date(req.body.dueDate)
        };

        const task = new Task(taskData);
        await task.save();

        res.status(201).json({
            status: 'success',
            data: task
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/tasks', async (req, res, next) => {
    try {
        const { userId, status, priority, sortBy, order = 'asc', search } = req.query;
        
        let filter = { userId }; // Filter tasks by user ID
        if (status && status !== 'all') filter.status = status;
        if (priority && priority !== 'all') filter.priority = priority;
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        let sort = {};
        if (sortBy) {
            sort[sortBy] = order === 'asc' ? 1 : -1;
        } else {
            sort.createdDate = -1;
        }

        const tasks = await Task.find(filter)
            .sort(sort)
            .select('-__v')
            .lean();

        res.json({
            status: 'success',
            results: tasks.length,
            data: tasks
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/tasks/:id', async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id).lean();
        if (!task) {
            return res.status(404).json({
                status: 'error',
                message: 'Task not found'
            });
        }
        res.json({
            status: 'success',
            data: task
        });
    } catch (err) {
        next(err);
    }
});

app.put('/api/tasks/:id', async (req, res, next) => {
    try {
        const allowedUpdates = ['title', 'description', 'status', 'priority', 'dueDate'];
        const updates = Object.keys(req.body)
            .filter(key => allowedUpdates.includes(key))
            .reduce((obj, key) => {
                obj[key] = req.body[key];
                return obj;
            }, {});

        if (updates.dueDate) {
            updates.dueDate = new Date(updates.dueDate);
        }

        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { ...updates, lastModified: new Date() },
            { new: true, runValidators: true }
        );

        if (!task) {
            return res.status(404).json({
                status: 'error',
                message: 'Task not found'
            });
        }

        res.json({
            status: 'success',
            data: task
        });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/tasks/:id', async (req, res, next) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                status: 'error',
                message: 'Task not found'
            });
        }

        res.json({
            status: 'success',
            message: 'Task deleted successfully'
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/tasks/stats/summary', async (req, res, next) => {
    try {
        const { userId } = req.query;
        
        const stats = await Task.aggregate([
            {
                $match: { userId: new mongoose.Types.ObjectId(userId) }
            },
            {
                $group: {
                    _id: null,
                    totalTasks: { $sum: 1 },
                    pendingTasks: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    ongoingTasks: {
                        $sum: { $cond: [{ $eq: ['$status', 'ongoing'] }, 1, 0] }
                    },
                    completedTasks: {
                        $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] }
                    },
                    highPriorityTasks: {
                        $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.json({
            status: 'success',
            data: stats[0] || {
                totalTasks: 0,
                pendingTasks: 0,
                ongoingTasks: 0,
                completedTasks: 0,
                highPriorityTasks: 0
            }
        });
    } catch (err) {
        next(err);
    }
});

// Error handling middleware should be last
app.use(errorHandler);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});