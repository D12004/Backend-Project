//We import the neccessary module here
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

// Asign the settings for hosting the app
const app = express();
const port = process.env.PORT || 3000;

// Start the middleware
app.use(express.json());

// Setup the settings for CORS Middleware
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}
	next();
});

// Setup a logger for our server
// Every api request will go through thi code
app.use((req, res, next) => {
	console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
	next();
});

// We serve image files with this code
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/images', (req, res) => {
	res.status(404).send('There is no image. Kindly double check the URL you are using.');
});

// Start the database connection
const uriForMongoClient = process.env.MONGODB_URI || 'mongodb+srv://oladipupooni7:12345@cluster0.k9pmt.mongodb.net/';
const client = new MongoClient(uriForMongoClient);

// Assign these empty variables or we get an error
let theLessonsCollection;
let theOrdersCollection;

async function run() {
	try {
		await client.connect();
		console.log('MongoDB connection successful');

		const databaseVariable = client.db('webstore');
		theLessonsCollection = databaseVariable.collection('lessons');
		theOrdersCollection = databaseVariable.collection('orders');

		app.get('/', (req, res) => {
			res.send(`<a href="/orders">Orders</a>
					  <a href="/lessons">Lessons</a>`);
		});

		// GET request on route /lessons to get all lessons
		app.get('/lessons', async (req, res) => {
			try {
				const allLessons = await theLessonsCollection.find({}).toArray();
				res.json(allLessons);
			} catch (error) {
				console.error(error);
				res.status(500).json({ error: 'Error Code 500. Could not fetch lessons' });
			}
		});

		// GET request on route /orders to get all orders
		app.get('/orders', async (req, res) => {
			try {
				const allOrders = await theOrdersCollection.find({}).toArray();
				res.json(allOrders);
			} catch (error) {
				console.error(error);
				res.status(500).json({ error: 'Error Code 500. Could not fetch orders' });
			}
		});

		// POST request on route /orders to create a new order
		app.post('/orders', async (req, res) => {
			try {
				const orderToInsert = req.body;
				const resultFromDatabase = await theOrdersCollection.insertOne(orderToInsert);
				res.status(201).json({ message: 'Your order was successfully created', orderId: resultFromDatabase.insertedId });
			} catch (error) {
				console.error(error);
				res.status(500).json({ error: 'Error Code 500. Could not insert order' });
			}
		});

		// PUT request on route /lessons to update any attribute of the lesson collection
		app.put('/lessons', async (req, res) => {
			try {
				const lessonData = req.body;
				delete lessonData._id;

				const { id, ...remainingFields } = lessonData;

				const resultFromDatabase = await theLessonsCollection.updateOne({ id: id }, { $set: remainingFields });

				res.json({ message: 'Lesson was successfully updated' });
			} catch (error) {
				console.error(error);
				res.status(500).json({ error: 'Updation for lesson was failed' });
			}
		});

		// GET request on route /search to perform a full text search

		app.get('/search', async (req, res) => {
			const queryToSearchFor = req.query.search_query || '';

			try {
				// If the query is empty, then return all lessons
				if (!queryToSearchFor) {
					const allLessonsFromDatabase = await theLessonsCollection.find({}).toArray();
					return res.json(allLessonsFromDatabase);
				}

				// Use regex to make it case-insensitive
				const regexExpression = new RegExp(queryToSearchFor, 'i');

				const resultsFromDatabase = await theLessonsCollection
					.find({
						$or: [
							{ topic: regexExpression },
							{ location: regexExpression },
							{
								$expr: {
									$regexMatch: {
										input: { $toString: '$price' },
										regex: queryToSearchFor,
										options: 'i',
									},
								},
							},
							{
								$expr: {
									$regexMatch: {
										input: { $toString: '$space' },
										regex: queryToSearchFor,
										options: 'i',
									},
								},
							},
						],
					})
					.toArray();

				res.json(resultsFromDatabase);
			} catch (err) {
				console.error(err);
				res.status(500).json({ error: 'Search query operation was failed.' });
			}
		});

		// Run the server
		app.listen(port, () => {
			console.log(`Server is running on port ${port}`);
		});
	} catch (error) {
		console.error(error);
	}
}

run().catch(console.dir);
