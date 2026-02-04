require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Category = require("../models/Category");
const Recipe = require("../models/Recipe");

const demoUsers = [
  {
    f_name: "System",
    l_name: "Admin",
    email: "admin@example.com",
    password: "Admin123!",
    role: "admin"
  },
  {
    f_name: "Maya",
    l_name: "Patel",
    email: "maya@example.com",
    password: "User123!",
    role: "user"
  },
  {
    f_name: "Ethan",
    l_name: "Nguyen",
    email: "ethan@example.com",
    password: "User123!",
    role: "user"
  },
  {
    f_name: "Liam",
    l_name: "Garcia",
    email: "liam@example.com",
    password: "User123!",
    role: "user"
  }
];

const demoCategories = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Dessert",
  "Vegetarian",
  "Vegan",
  "Mediterranean"
];

const demoRecipes = [
  {
    title: "Mediterranean Chickpea Bowl",
    desc: "Fresh veggies, chickpeas, and a lemon herb dressing.",
    category: "Mediterranean",
    rating: 5,
    ingredients: ["chickpeas", "cucumber", "tomato", "olive oil", "lemon"],
    instructions: ["Prep veggies", "Mix dressing", "Combine and serve"],
    tags: ["healthy", "quick"],
    difficulty: "Easy"
  },
  {
    title: "Creamy Mushroom Pasta",
    desc: "Silky mushroom sauce tossed with pasta.",
    category: "Dinner",
    rating: 4,
    ingredients: ["mushrooms", "garlic", "cream", "pasta"],
    instructions: ["Saute mushrooms", "Add cream", "Toss pasta"],
    tags: ["comfort", "italian"],
    difficulty: "Medium"
  },
  {
    title: "Berry Overnight Oats",
    desc: "Make-ahead oats with berries and yogurt.",
    category: "Breakfast",
    rating: 4,
    ingredients: ["oats", "milk", "berries", "yogurt"],
    instructions: ["Mix ingredients", "Chill overnight", "Serve"],
    tags: ["meal-prep"],
    difficulty: "Easy"
  },
  {
    title: "Vegan Buddha Bowl",
    desc: "Roasted veggies, quinoa, and tahini dressing.",
    category: "Vegan",
    rating: 5,
    ingredients: ["quinoa", "sweet potato", "broccoli", "tahini"],
    instructions: ["Roast veggies", "Cook quinoa", "Assemble bowl"],
    tags: ["vegan", "gluten-free"],
    difficulty: "Easy"
  },
  {
    title: "Dark Chocolate Brownies",
    desc: "Fudgy brownies with a rich chocolate flavor.",
    category: "Dessert",
    rating: 5,
    ingredients: ["cocoa", "flour", "eggs", "butter"],
    instructions: ["Mix batter", "Bake", "Cool and slice"],
    tags: ["dessert"],
    difficulty: "Easy"
  },
  {
    title: "Quick Avocado Toast",
    desc: "Smashed avocado on toasted sourdough.",
    category: "Snack",
    rating: 3,
    ingredients: ["bread", "avocado", "salt", "pepper"],
    instructions: ["Toast bread", "Mash avocado", "Assemble"],
    tags: ["snack", "quick"],
    difficulty: "Easy"
  }
];

const seedUsers = async () => {
  const users = {};
  for (const user of demoUsers) {
    const existing = await User.findOne({ email: user.email });
    if (existing) {
      users[user.email] = existing;
      continue;
    }

    const hashed = await bcrypt.hash(user.password, 10);
    const created = await User.create({
      f_name: user.f_name,
      l_name: user.l_name,
      email: user.email,
      password: hashed,
      role: user.role,
      active: 1,
      created_date: new Date()
    });
    users[user.email] = created;
  }
  return users;
};

const seedCategories = async (adminId) => {
  for (const name of demoCategories) {
    const existing = await Category.findOne({ name });
    if (!existing) {
      await Category.create({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: `${name} recipes`,
        isActive: true,
        createdBy: adminId,
        updatedBy: adminId
      });
    }
  }
};

const seedRecipes = async (users) => {
  const userList = Object.values(users).filter((u) => u.role !== "admin");
  if (!userList.length) return;

  for (let i = 0; i < demoRecipes.length; i += 1) {
    const owner = userList[i % userList.length];
    const recipe = demoRecipes[i];
    const existing = await Recipe.findOne({
      title: recipe.title,
      userId: owner._id
    });
    if (existing) continue;

    await Recipe.create({
      userId: owner._id,
      title: recipe.title,
      desc: recipe.desc,
      category: recipe.category,
      rating: recipe.rating,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      tags: recipe.tags,
      difficulty: recipe.difficulty
    });
  }
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await seedUsers();
    const admin = users["admin@example.com"];
    if (admin) {
      await seedCategories(admin._id);
    }
    await seedRecipes(users);

    console.log("Demo data seeded successfully.");
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
