const { User } = require("../models/user");
const moment = require("moment");
const { auth, isUser, isAdmin } = require("../middleware/auth");

const router = require("express").Router();

//Get user stats (only admin can access this data right k

router.get("/stats", isAdmin,   async (req, res) => {
    const previousMonth = moment()    //moment here will help us get the currnt date
    .month(moment().month() - 1)
    .set("date", 1)
    .format("YYY-MM-DD HH:mm:ss");

    try {
        const users = await User.aggregate([ //go to your browser search for mongodb aggregate to no more about it
            {
              $match: { createdAt: { $gte: new Date(previousMonth) } },   //parse an object  whatever operation to perform 
            },                                                            //this mongodb operation
            {
                $project:{                                         //returning an aray containing id and total
                   month: {$month: "$createdAt"},
                },
            }, 
            {
                $group:{
                  _id: "$month", 
                  total: { $sum: 1 },
                },
            },                                                            //will start from previous month
        ]);

        res.status(200).send(users);
    }catch (err) {
        console.log(err); 
        res.status(500).send(err);  //sending arror messgae to the client
    }
});


// GET all users of the same company (freelancers + staff)
router.get("/company", auth, async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ message: "User is not linked to a company" });
    }

    const users = await User.find({
      companyId: req.user.companyId,
      $or: [{ isFreelancer: true }, { isStaff: true }],
    }).select("_id name email isFreelancer isStaff");

    res.status(200).json(users);
  } catch (err) {
    console.error("🔥 [GET COMPANY USERS ERROR]:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;


