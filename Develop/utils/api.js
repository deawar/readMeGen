const axios = require('axios');
require('dotenv').config();
const figlet = require("figlet");
const chalk = require("chalk");
const inquirer = require('inquirer');
const fs = require('fs');
console.log(process.env.SECRET_MESSAGE);
const TOKEN = process.env.TOKEN;

console.log("Found api.js",{TOKEN});
const api = async (username) => {
  try{
    // const gitInfo = await getUser (username);
    console.log({TOKEN});
    const gitUrl = `https://api.github.com/users/${username}`; //${TOKEN}
    const response = await axios({
      method: "get",
      url: gitUrl,
      headers: {
      authorization: `token:${TOKEN}`  
      }
    })
    
    console.log("Line 24 Response Data: ",response.data)
    const {html_url, login, avatar_url, repos_url, email, name, bio} = response.data;
      const gitInfo = {
        "html_url": html_url,
        "login": login,
        "avatar_url": avatar_url,
        "repos_url": repos_url,
        "email": email,
        "name" : name,
        "bio": bio
      };
      return gitInfo
    }     
    catch(err){
      console.log("That ain't right... I think you misspelled sumthin...")
      if (err.response.status >= 401) {
        console.log("Line 39 in api.js error block");
        return null;
      }
    }
};
module.exports = api;
