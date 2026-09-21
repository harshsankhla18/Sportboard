import express from 'express';
import {matchRouter} from "./routes/matches.routes.js";

const app = express();

const PORT  = 8000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Sportboard server!' });
});
app.use('/matches', matchRouter);
// app.post('/matches', matchRouter);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
