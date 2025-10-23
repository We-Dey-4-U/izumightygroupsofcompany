const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const register = require("./routes/register");
const login = require("./routes/login");
const stripe = require("./routes/stripe");
const productsRoute = require("./routes/products");
const users = require("./routes/users");
const orders = require("./routes/orders");
//to import our array of products from product.js file
const products = require("./products"); 
//initialize our app(an object) that contains various method which we can use to create our app
const app = express(); 
                  
require("dotenv").config(); 

//now we are going to use the app to call different method from express
//we are going to configure our middleware function in other to control the request and response of our api
//when we use app.use method.we are simply configuring what we call middleware function
//first we configure the json.express.json is a middleware function and what it does
//in node.js is to simply increase the functionality or expand functionaliy of our application
app.use(express.json());  
//cors will allow us to access node.js api from our react application
app.use(cors());      

// Serve uploaded images
app.use("/uploads", express.static("uploads"));


app.use("/api/register", register); 
app.use("/api/login", login);
app.use("/api/stripe", stripe);
app.use("/api/products", productsRoute);
app.use("/api/users", users);
app.use("/api/orders", orders);


//we come and create a simple routes to handle a get request we now say app.get we call this method()
//request represent whatever is coming in from the content and respose whatevr will be given back from this particular api
//this represent the path for the routes("/") with call back funtion that has access to req and res((reg res)=>)
app.get("/", (req, res) => {   
  res.send("Welcome to our online shop API...");   
}); 

//this will help us access our api product.js file from the frontend
app.get("/products", (req, res) => { 
  res.send(products);
});

//this will read our port from our environment variable
const uri = process.env.CONNECTION_STRING;
const port = process.env.PORT || 2000; 

//this will configure our port
app.listen(port, () => {
  console.log(`Server running on port: ${port}...`);
});

mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connection established..."))
  .catch((error) => console.error("MongoDB connection failed:", error.message));



  //we run our application using nodemon