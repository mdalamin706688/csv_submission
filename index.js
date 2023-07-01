const express = require('express');
const { MongoClient } = require('mongodb');
const rateLimit = require('express-rate-limit');
const json2csv = require('json2csv').parse;
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ih3he87.mongodb.net/?retryWrites=true&w=majority`;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // maximum 100 requests per windowMs
});

app.use('/api/submit', limiter);

async function connectToMongoDB() {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    //await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

app.get('/', (req, res) => {
  res.send('Hello, Nodemon!');
});

app.post('/api/submit', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers.authorization;

    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { email, source, userAgent, timestamp } = req.body;

    const client = await connectToMongoDB();
    const collection = client.db('vercel').collection('datas');
    const result = await collection.insertOne({
      email,
      source,
      userAgent,
      timestamp,
    });
    client.close();

    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/submissions/csv', async (req, res) => {
  try {
    const client = await connectToMongoDB();
    const collection = client.db('vercel').collection('datas');
    const submissions = await collection.find().toArray();
    client.close();

    const csv = json2csv(submissions, { fields: ['email', 'source', 'userAgent', 'timestamp'] });
    const filename = 'submissions.csv';

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
