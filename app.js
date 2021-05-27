var mysql = require("mysql");
const express = require("express");
const app = express();
const md5 = require("md5");

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "rakshitinmk-99",
  database: "db",
});
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());
con.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

var semaphore = {};

con.query("SELECT * from equity;", function (e, r) {
  if (e) res.send("Error reading list");
  else {
    for (let i = 0; i < r.length; i++) {
      var key = r[i]["id"];
      semaphore[key] = false;
    }
  }
//   console.log(semaphore);
});

app.post("/register", function (req, res) {
  let fname = req.body.fname;
  let lname = req.body.lname;
  let user_name = req.body.user;
  let email = req.body.email;
  let pass = req.body.password;
  con.query(
    'insert into user(first_name,last_name,user_name,password,email) VALUES("' +
      fname +
      '","' +
      lname +
      '","' +
      user_name +
      '","' +
      md5(pass) +
      '","' +
      email +
      '");',
    function (er, r, fields) {
      if (er) res.send(er);
      else {
        // console.log(fields);
        console.log("ID: " + r["insertId"]);
        let user_id = r["insertId"];
        con.query(
          "create table user_" +
            user_id +
            " ( item_id int NOT NULL, price double NOT NULL, qty int NOT NULL);"
        );
        res.send("User Registered Successfully");
      }
    }
  );
});

function updateInventory(uid, item_id, qty) {
  con.query(
    "update user_" +
      uid +
      " set qty = qty+" +
      qty +
      " where item_id=" +
      item_id +
      ";",
    function (err, r) {
      if (err) {
        console.log(err);
        // res.send(err);
      } else console.log("Inventory Updated");
    }
  );
}

function updateEquity(item_id, qty) {
  let rate = 1.01;
  if (qty > 0) {
    rate = 0.99;
  }
  con.query(
    "update equity set price = price*" +
      rate +
      ", qty=qty+" +
      qty +
      " where id = " +
      item_id +
      ";",
    function (err, res) {
      if (err) console.log("Error 4");
      else {
        console.log("Equity Updated Successfully");
      }
    }
  );
}
app.post("/delete", function (req, res) {
  let uid = req.body.uid;
  con.query("delete from user_" + uid + ";", function (err, r) {
    if (err) res.send("Error");
    else {
      res.send("Entries deleted");
    }
  });
});

app.get("/getHoldings", function (req, res) {
  let uid = req.body.uid;
  con.query("Select * from user_" + uid + ";", function (err, r) {
    if (err) res.send("Error getting holdings");
    else {
      res.send(r);
    }
  });
});

app.get("/equityList", function (req, res) {
  con.query("SELECT * from equity;", function (e, r) {
    if (e) res.send("Error reading list");
    else {
      res.send(r);
    }
  });
});

app.post("/buy", function (req, res) {
  let user_id = req.body.uid;
  let item_id = req.body.item_id;
  let price = req.body.price;
  let qty = req.body.qty;
  while (semaphore[item_id]);
  semaphore[item_id] = true;
  con.query(
    "select * from equity where id=" + item_id + ";",
    function (er, equity) {
      if (er) {
        console.log(er);
        res.send("Error 1");
      } else {
        let aval_qty = equity[0].qty;
        if (aval_qty > qty) {
          con.query(
            "select * from user_" + user_id + " where item_id=" + item_id + ";",
            function (err, r) {
              if (err) {
                console.log(err);
                res.send("Error 2");
              } else {
                console.log(r);
                if (Object.keys(r).length == 0) {
                  con.query(
                    "insert into user_" +
                      user_id +
                      ' ( item_id, price, qty) VALUES ("' +
                      item_id +
                      '","' +
                      price +
                      '","' +
                      qty +
                      '");',
                    function (err, ress) {
                      if (err) res.send("Error buying");
                      else {
                        res.send("Equity bought successfully");
                      }
                    }
                  );
                } else {
                  updateInventory(user_id, item_id, qty);
                  res.send("Equity added successfully");
                }
              }
            }
          );
          updateEquity(item_id, qty * -1);
        } else res.send("Only " + aval_qty + " is available");
      }
    }
  );
  semaphore[item_id] = false;
});

app.post("/sell", function (req, res) {
  let user_id = req.body.uid;
  let item_id = req.body.item_id;
  let price = req.body.price;
  let qty = req.body.qty;
  while (semaphore[item_id]);
  con.query(
    "select * from user_" + user_id + " where item_id=" + item_id + ";",
    function (er, equity) {
      if (er) {
        console.log(er);
        res.send("Error 1");
      } else {
        if (Object.keys(equity).length > 0) {
          let aval_qty = equity[0].qty;
          if (aval_qty > qty) {
            updateEquity(item_id, qty);
            updateInventory(user_id, item_id, qty * -1);
            res.send("Sold Successfully");
          } else if (aval_qty == qty) {
            con.query(
              "delete from user_" + user_id + " where item_id=" + item_id + ";",
              function (e, r) {
                if (e) {
                  console.log(e);
                  res.send("Error deleting");
                } else {
                  updateEquity(item_id, qty);
                  res.send("Sold Successfully");
                }
              }
            );
          } else res.send("Only " + aval_qty + " is available");
        } else {
          res.send("You do not own this equity");
        }
      }
    }
  );
  semaphore[item_id] = false;
});

app.post("/login", function (req, res) {
  console.log(req.body);
  let email = req.body.email;
  let pass = req.body.password;
  console.log(email);
  console.log(pass);
  con.query(
    "SELECT password from user where email = '" + email + "';",
    function (err, result) {
      console.log(result);
      console.log(typeof result);
      if (err) res.send(err);
      if (Object.keys(result).length != 0 && result[0].password == md5(pass))
        res.send("Login Successful");
      else res.send("Incorrect Password");
    }
  );
});

app.post("/addEquity", function (req, res) {
  let symbol = req.body.symbol;
  let name = req.body.name;
  let qty = req.body.quantity;
  let price = req.body.price;
  con.query(
    'insert into equity(symbol,name,price,qty) VALUES("' +
      symbol +
      '","' +
      name +
      '","' +
      price +
      '","' +
      qty +
      '");',
    function (er, r) {
      if (er) res.send(er);
      else {
        semaphore[r["insertId"]] = false;
        res.send("Equity Added Successfully");
      }
    }
  );
});
app.listen(3000, function () {
  console.log("Server started at port 3000");
});
