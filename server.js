var express = require('express');
var mongo = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var multer  = require('multer')
var bcrypt = require('bcrypt');
var cors = require('cors');
var gcm = require('node-gcm');
const saltRounds = 10;

var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);

var activeUsers = [];

var port = 3000;
var db;

var filename;

//push notifications
var sender = new gcm.Sender('AAAALZ3KnzQ:APA91bEqXgPxY2rQAE8G78hqauB-bo3gdHRKzcOZsx5_1WLfjcAUdnz94z9ol9jwNelj1oc_gHJeOsDtYk-cvVxcDh-FQejjid1uD4xZwSD10T6MjNGcERG6ydft6wQWS6VrzRggYTH4');

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));
app.use(cors());

// Store profile picture on disc, specify path
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, __dirname + '/uploads')
    },
    filename: function (req, file, cb) {
        cb(null, createProfilePictureFileName(file.originalname, req.body.userid))
    }
})
var upload = multer({ storage: storage })

mongo.connect('mongodb://shutapp:shutapp123@ds133981.mlab.com:33981/shutapp', function(err, database) {
    if (err) {
        console.log(err);
    }
    db = database;
});

app.use(session({
    secret: 'please shutapp',
    resave: true,
    saveUninitialized: false,
    store: new MongoStore({url: 'mongodb://shutapp:shutapp123@ds133981.mlab.com:33981/shutapp'})
}));

app.post('/messages', function(req, res) {
    var newMessage = req.body;
    newMessage.timestamp = new Date();
    console.log(newMessage);
    db.collection('chatMessages').insert(newMessage).then(function(result) {
        //201 is a "created" status code
        if(result) {
            res.status(201).send({});
        } else {
            res.status(400).send({});
        }
    });
});

app.post('/private-messages', function(req, res) {
    var newPrivateMessage = req.body;
    newPrivateMessage.timestamp = new Date();
    console.log(newPrivateMessage);
    db.collection('privateMessages').insert(newPrivateMessage).then(function(result) {
        //201 is a "created" status code
        if(result) {
            res.status(201).send({});
        } else {
            res.status(400).send({});
        }
    });
});

app.get('/messages', function(req, res) {
    if(req.query.user) {
        var collection = 'privateMessages';
        var user = req.query.user;
        var otherUser = req.query.otheruser;
        var findObject = {$or: [ {senderId: user, recipientId: otherUser}, {senderId: otherUser, recipientId: user} ] };
    } else {
        var collection = 'chatMessages';
        var findObject = {"chatroom":req.query.chatroom};
    }

    db.collection(collection).find(findObject).toArray(function(err, result) {
        //TODO: add error thing
        if(err) {
            res.status(500).send({});
        }
        res.status(200).send(result);
    });
});

// Save users profile picture on disc. See multer.discStorage
app.post('/upload', upload.single('avatar'), function (req, res, next) {
    //save file path to user collection in database
    db.collection('users').findOneAndUpdate(
        {"_id": ObjectID(req.body.userid) },
        { $set: {"picturePath": "/uploads/" + createProfilePictureFileName(req.file.originalname, req.body.userid)}
        }).then(function() {
        res.status(201).send();
    });
    res.status(200).send();
});

//Get list of users with which we have had a conversation
app.get('/conversations', function(req, res) {
    var userId = req.query.userid;
    var conversationUsers = [];
    var collectionCounter = 0;
    db.collection('users').count().then(function(collectionSize) {
        db.collection('users').find().forEach(function(otherUser) {
            var otherUserId = otherUser._id.toString();
            db.collection('privateMessages').findOne({$or: [{ "senderId": userId, "recipientId": otherUserId }, { "senderId": otherUserId, "recipientId": userId }] }).then(function(obj) {
                collectionCounter++;
                if(obj) {
                    conversationUsers.push({id: otherUserId, name: otherUser.username});
                }
                if(collectionCounter == collectionSize) {
                    res.status(200).send(conversationUsers);
                }
            });
        }, function(err) {
            console.log("conversation error? ", err);
        });
    });
});

app.get('/chatrooms', function(req, res) {
    //find all chatrooms and add these to a list
    db.collection('chatrooms').find().toArray(function (error, result){
        if(error) {
            res.status(500).send(error);
            return;
        }
        //result is an array with chatroom objects
        res.status(200).send(result);
    });
});

app.post('/chatrooms/add', function(req, res) {
  if(req.body.name === undefined || req.body.name.length < 3 || req.body.name.length > 15) return res.status(406).send();
  var roomName = req.body.name.toLowerCase();
  db.collection('chatrooms').count({"name": roomName}).then(function(error, result) {
    if(!error) {
      db.collection('chatrooms').insertOne({"name": roomName, "users": []}).then(function(cb) {
        if(cb.result.ok > 0) {
          io.emit('refresh chatroom');
          res.status(201).send();
        } else {
          res.status(500).send();
        }
      });
    } else {
      res.status(400).send();
    };
  })
});

app.post('/signup', function(req, res) {
    //all usernames are stored as lowercase for simplicity
    var username = req.body.username.toLowerCase();
    var email = req.body.email.toLowerCase();
    var password = req.body.password;
    if(!email.match(/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/)
        || !username.match(/[0-9a-zA-Z]{3,20}/)
        || !password.match(/^.{6,50}$/) ) {
        //400 is "bad request"
        res.status(400).send({});
        return;
    }

    db.collection('users').findOne( { "username": username }, function(err, user) {
        if(err) {
            //Server error
            res.status(500).send(err);
        } else {
            console.log(user);
            //if the user does not already exist in the database, create a new user
            if(user === null) {
                db.collection('users').findOne( { "email": email }, function(err, user) {
                    if(err) {
                        res.status(500).send(err);
                    } else {
                        if(user === null) {
                            //Add user to the database
                            bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log(hash);
                                    db.collection('users').insert({username: username, email: req.body.email, password: hash}).then(function() {
                                        res.status(201).send({redirect:'/'});
                                    });
                                }
                            });
                        } else {
                            res.status(409).send({"reason":"email"});
                        }
                    }
                });
            } else {
                //409 means "conflict".
                res.status(409).send({"reason":"username"});
            }
        }
    });
});

app.get('/logout', function(req, res, next) {
    if(req.session) {
        req.session.destroy();
    }
});

//GET one or all users. Not finished!
app.get('/users/:id?', function (req, res) {
    var searchObject = {};
    if(req.params.id) searchObject = { "_id": ObjectID(req.params.id) };
    console.log(searchObject);
    db.collection('users').find(searchObject).toArray(function(err, result) {
        if (err) return res.status(500).send(error);
        var userObject = { "id": result._id, "name": result.username }
        res.status(200).send(userObject);
    });
});

app.post('/users/update', function (req, res) {
    var id = req.body.id;
    var newUsername = req.body.username.toLowerCase();

    if (!newUsername.match(/[0-9a-zA-Z]{3,20}/)) res.status(400).send({});
    db.collection('users').findOne({"username": newUsername}).then(function(doc) {
        if(!doc) {
            db.collection('users').findOneAndUpdate({"_id": ObjectID(id) }, { $set: {"username": newUsername}}).then(function(err) {
                console.log('updated username');
                updateMessages();
                res.status(200).send({});
            });
        } else {
            console.log('failed update');
            res.status(400).send({});
        }
    })

    //Updates all messages in the database with the new username.
    updateMessages = function() {
        console.log('Updating database messages for user: ' + id);
        db.collection('privateMessages').updateMany({"senderId": id }, { $set: {"senderName": newUsername}}).then(function(doc) {
            console.log('Found:' + doc.matchedCount, 'Modified:' + doc.modifiedCount);
        });
        db.collection('privateMessages').updateMany({"recipientId": id }, { $set: {"recipientName": newUsername}}).then(function(doc) {
            console.log('Found:' + doc.matchedCount, 'Modified:' + doc.modifiedCount);
        });
        db.collection('chatMessages').updateMany({"senderId": id }, { $set: {"senderName": newUsername}}).then(function(doc) {
            console.log('Found:' + doc.matchedCount, 'Modified:' + doc.modifiedCount);
        });
        for(var i = 0; i < activeUsers.length; i++) {
            if(activeUsers[i].id == id) {
                console.log('changed username in activeUsers.');
                activeUsers[i].name = newUsername;
                io.emit('active users', activeUsers);
            }
        }
    };
});

app.post('/device', function(req, res) {
    //This is run at login. Add device to database
    db.collection('users').update({"_id": ObjectID(req.body.id)}, {$addToSet: {"devices": req.body.token}}).then(function(doc) {
        console.log("registered a device");
    });
});

app.post('/removedevice', function(req, res) {
    //This is run at logout. Remove device from database
    db.collection('users').update({"_id": ObjectID(req.body.id)}, {$pull: {"devices": req.body.token}}).then(function(doc) {
        console.log("removed a device");
    });
});

app.get('/login/:username/:password', function (req, res) {
    db.collection('users').findOne({username: req.params.username.toLowerCase()}, function(err, user) {
        if(err) {
            console.log('Loginrequest caused database error.');
            res.status(500).send(err);
        } else if(user === null) {
            console.log('Loginrequest with invalid username.');
            res.status(401).send({});
        } else if(!bcrypt.compareSync(req.params.password, user.password)) {
            console.log('Loginrequest with invalid password.');
            res.status(401).send({});
        } else if(bcrypt.compareSync(req.params.password, user.password)) {
            console.log('Loginrequest for ' + user.username + ' successful.');
            //Adds the userID to the session for the server to track.
            req.session.userId = user._id;
            res.status(200).send({
                _id: user._id,
                username: user.username,
                image: user.image,
                redirect: 'messages'
            });
        } else {
            console.log("Some other error...");
        }
    });
});

io.on('connection', function(socket){
    console.log("socket id:", socket.id);
    socket.on('connected', function(user) {
        socket.username = user.name;
        console.log(socket.username + " has connected.");
        var isInList = false;
        for (var i = 0; i < activeUsers.length; i++)  {
            if (user.id == activeUsers[i].id) isInList = true;
        }
        if (!isInList) activeUsers.push({ name: socket.username, id: user.id, socketId: socket.id });
        console.log("Active users: ", activeUsers);
        io.emit('active users', activeUsers);
    });
    socket.on('private message', function(message){
        message.timestamp = new Date();
        //Gets correct socketId for recipient.
        var index = activeUsers.findIndex(function(activeUser) {
            return activeUser.id === message.recipientId;
        });
        if(index >= 0) {
            //Send to the other person
            socket.to(activeUsers[index].socketId).emit('private message', message);
        } else {
            //Prepare notification
            var pushNotification = new gcm.Message({
                data: {
                    "key": "msg"
                 },
                 notification: {
                    "tag": message.senderId,
                    "title": "ShutApp",
                    "body": message.senderName + " skriver: " + message.text,
                    "sound": "default"
                 }
            });
            //get regTokens from database
            db.collection('users').findOne({"_id": ObjectID(message.recipientId)},{"devices": 1}).then(function(obj) {
                var regTokens = obj.devices;
                console.log("tokens: ", obj.devices);
                //Send the notification
                if(regTokens) {
                    sender.send(pushNotification, { registrationTokens: regTokens }, function (err, response) {
                        if (err) console.error("error: ", err);
                    });
                }
            });
        }
        //Send to myself
        socket.emit('private message', message);
    });
    socket.on('connect message', function(message) {
        socket.broadcast.emit('connect message', message);
    });
    socket.on('disconnect message', function(message) {
        io.emit('disconnect message', message);
    });
    socket.on('disconnect', function() {
        if (activeUsers.findIndex(function(obj) {return obj.name === socket.username;}) != -1) {
            activeUsers.splice(activeUsers.findIndex(function(obj) {
                console.log(socket.username + " has disconnected.");
                return obj.name === socket.username;
            }), 1);
            socket.broadcast.emit('active users', activeUsers);
            socket.broadcast.emit('disconnect message', {timestamp: new Date(), text: socket.username + " har loggat ut."});
        }
    });
    socket.on('join chatroom', function(chatroomId) {
        socket.join(chatroomId, function() {
            console.log("socket.rooms: ", socket.rooms);
        });
        socket.emit('join chatroom');
    });
    socket.on('chatroom message', function(message) {
        //console.log("In server.js", message);
        //console.log("socket rooms: ", socket.rooms);
        message.timestamp = new Date();
        io.in(message.chatroom).emit('chatroom message', message);
    });
    socket.on('leave chatroom', function(chatroomId) {
        socket.leave(chatroomId);
    });
    socket.on('change username', function(obj) {
        io.emit('change username', obj);
    });
});

http.listen(port, function(){
    console.log('Listening on: ' + port);
});

function createProfilePictureFileName(originalFileName, userId){
    //var originalname = file.originalname;
    var fileExtension = originalFileName.split(".")[1];
    //var filename = req.body.userid;
    return userId + '.' + fileExtension;
}
