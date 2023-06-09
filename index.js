const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe=require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6g3butq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("PranayamaDB").collection("users");
    const classCollection = client.db("PranayamaDB").collection("classes");
    const selectclassCollection = client.db("PranayamaDB").collection("selectclasses");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    ///
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'Forbidden: Only instructors can access this resource.' });
      }
      
      next();
    };
    

        ///
        const verifyStudent = async (req, res, next) => {
          const email = req.decoded.email;
          const query = { email: email }
          const user = await usersCollection.findOne(query);
          if (user?.role !== 'student') {
            return res.status(403).send({ error: true, message: 'Forbidden: Access denied' });
          }
          next();
        }


    // users related apis
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    //get all instructor
    app.get('/instructorusers', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    //get all classes
    app.get('/approvedclass', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

// Admin route
app.get('/users/admin/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;

  if (req.decoded.email !== email) {
    res.send({ admin: false });
  }

  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const result = { admin: user?.role === 'admin' };
  res.send(result);
});

app.patch('/users/role/:id', async (req, res) => {
  const id = req.params.id;
  const { role } = req.body;

  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: role,
    },
  };

  try {
    const result = await usersCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send('Error updating user role');
  }
});


// Student route
app.get('/users/student/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;

  if (req.decoded.email !== email) {
    res.send({ student: false });
  }

  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const result = { student: user?.role === 'student' };
  res.send(result);
});

// Instructor route
app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;

  if (req.decoded.email !== email) {
    res.send({ instructor: false });
  }

  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const result = { instructor: user?.role === 'instructor' };
  res.send(result);
});

//class add
app.post('/class', verifyJWT, verifyInstructor, async (req, res) => {
  const newItem = req.body;
  const result = await classCollection.insertOne(newItem)
  res.send(result);
})
//get classes
app.get('/classes',verifyJWT, verifyInstructor, async (req, res) => {
  const instructorEmail = req.decoded.email;

  const query = { instructorEmail };
  const classes = await classCollection.find(query).toArray();

  res.send(classes);
});

// Update class status
app.get('/adminclasses', verifyJWT, verifyAdmin, (req, res) => {
  classCollection.find({}).toArray()
    .then(classes => {
      res.send(classes);
    })
    .catch(error => {
      console.error(error);
      res.status(500).send("Internal Server Error");
    });
});


// Update class status
app.patch("/adminclasses/:id/status", verifyJWT,verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: { status } };

    const result = await classCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

//Send feedback to instructor
app.post("/adminclasses/:id/feedback", verifyJWT,verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { feedback } = req.body;

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: { feedback } };

    const result = await classCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

//stydent path
//class add
app.post('/selectclass', verifyJWT, verifyStudent, async (req, res) => {
  const newItem = req.body;
  const result = await selectclassCollection.insertOne(newItem)
  res.send(result);
})
//my select class
app.get('/selectclass', verifyJWT, verifyStudent, async (req, res) => {
  const studentEmail = req.decoded.email;

  const query = { userEmail: studentEmail };
  const classes = await selectclassCollection.find(query).toArray();

  res.send(classes);
});



    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Pranayama is sitting')
})

app.listen(port, () => {
  console.log(`Pranayama is sitting on port ${port}`);
})
