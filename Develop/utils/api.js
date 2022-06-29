import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();
//import 'dotenv/config';
import figlet from "figlet";
import chalk from "chalk";
import inquirer from 'inquirer';
import fs from 'fs';
const THIRD_ITEM = process.env.THIRD_ITEM;
const TOKEN = process.env.TOKEN;

const api = async (username) => {
  try{
    // const gitInfo = await getUser (username);
    console.log("secret message check: ",process.env.SECRET_MESSAGE);
    console.log("the Below Token variable: ",{THIRD_ITEM});
    const gitUrl = `https://api.github.com/users/${username}`; //${TOKEN}
    const response = await axios({
      method: "get",
      url: gitUrl,
      headers: {
      authorization: `token:${TOKEN}`  
      }
    })
    console.log("/n Line 25 Response Data: ",response.data.email)
    const {html_url, login, avatar_url, repos_url, email, name, bio} = response.data;
      
    if (response.data.email == null) {
      const gitInfo = {
        "html_url": html_url,
        "login": login,
        "avatar_url": avatar_url,
        "repos_url": repos_url,
        "email": html_url,
        "name" : name,
        "bio": bio
      };
      console.log("Line 38 gitInfo: ",gitInfo)
      return gitInfo
      
    } else {
      const gitInfo = {
        "html_url": html_url,
        "login": login,
        "avatar_url": avatar_url,
        "repos_url": repos_url,
        "email": email,
        "name" : name,
        "bio": bio
      };
      console.log("Line 51 gitInfo: ",gitInfo)
      return gitInfo
    }
    }     
    catch(err){
      console.log("That ain't right... I think you misspelled sumthin...")
      if (err.response.status >= 401) {
        console.log("Line 56 in api.js error block");
        return null;
      }
    }
};
export default api;
