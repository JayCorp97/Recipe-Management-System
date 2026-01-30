const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/recipes_db');

const categories = [
  { name: "Breakfast", type: "meal" },
  { name: "Lunch", type: "meal" },
  { name: "Dinner", type: "meal" },
  { name: "Asia", type: "region" },
  { name: "Europe", type: "region" },
  { name: "America", type: "region" }
];

mongoose.connection.once('open', async () => {
  try {
    await mongoose.connection.db
      .collection('categories')
      .insertMany(categories);

    console.log('Categories inserted successfully');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
