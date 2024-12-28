const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

// Initialize Express app
const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose
  .connect("mongodb://localhost:27017/OnlineExamDB")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Mongoose Schemas
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role:{
    type:String,
    enum:["faculty","admin"],
    default:"faculty"
  },
  subject:{
    type:String,
    default:"Maths"
  },
  email: String
});

const StudentSchema = new mongoose.Schema({
  name: String,
  roll_number: String,
  course: String,
  year: Number,
});

const CombinedSchema = new mongoose.Schema({
  subject_id: String,          // ID of the subject
  question_paper_url: String,  // URL of the uploaded question paper
  answer_sheet_url: String,       // ID of the student
  roll_number: String,         // Roll number of the student
  upload_date: { type: Date, default: Date.now }, // Date of upload
  assigned_to: String,         // Faculty ID assigned for review
  status: { type: String, default: "pending" },
  marks:{type:Number,default:0} // Review status
});

const answerSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  marksObtained: { type: Number, required: true },
  comments: { type: String, required: false },
});

// Grading schema referencing the student by roll number
const gradingSchema = new mongoose.Schema({
  roll_number: { type: String, ref: 'Student', required: true }, // Reference to Student's roll_number
  answers: [answerSchema], // Array of answers with grading details
  totalMarks: { type: Number, required: true }, // Total marks for the student
  dateOfGrading: { type: Date, default: Date.now },
   // Date when grading was done
});



// Models
const Admin = mongoose.model("Users", UserSchema);
const Student = mongoose.model("Student", StudentSchema);
// const AnswerSheet = mongoose.model("AnswerSheet", AnswerSheetSchema);
// const QuestionPaper = mongoose.model("QuestionPaper", QuestionPaperSchema);

const CombinedModel = mongoose.model("CombinedDocument", CombinedSchema);

const Grading = mongoose.model('Grading', gradingSchema);

app.get('/users/faculty', async (req, res) => {
  try {
    const facultyUsers = await Admin.find({ role: 'faculty' })
        // Select only username, _id, and subject fields
    res.json(facultyUsers);
  } catch (err) {
    res.status(500).json({ message: 'Server error----Faculty is 0 Members', error: err });
  }
});
// Admin Signup
app.post("/admin/signup", async (req, res) => {
  const { username, password, email } = req.body;
  const existingAdmin = await Admin.findOne({ username });
  
  if (existingAdmin) return res.status(400).json({ message: "Admin already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = new Admin({ username, password: hashedPassword, email });
  console.log(admin);
  await admin.save();

  res.status(201).json({ message: "Admin registered successfully" }); // Send a JSON response
});


// Admin Login
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
 
  // console.log(req.body);
  const admin = await Admin.findOne({ username });
  console.log(admin,"admin");
  
  if (!admin) return res.status(404).send("Admin not found");

  const validPassword = await bcrypt.compare(password, admin.password);
  if (!validPassword) return res.status(400).send("Invalid password");

  res.status(200).send({message:"User logged in",data:admin});
});


// Add Student
app.post("/students",async (req, res) => {
  const { name, roll_number, course, year } = req.body;

  if (!name || !roll_number || !course || !year) {
    return res.status(400).send("All fields are required");
  }

  try {
    const newStudent = new Student({
      name,
      roll_number,
      course,
      year,
    });

    await newStudent.save();
    res.status(201).send("Student added successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding student");
  }
});


app.post("/Que_Ans/upload", async (req, res) => {
  try {
    const { subject_id, question_paper_url, answer_sheet_url, roll_number, assigned_to } = req.body;

    // Check if the roll number exists in the Student model
    const studentExists = await Student.findOne({ roll_number });
    if (!studentExists) {
      return res.status(404).json({ message: "Student with the provided roll number not found" });
    }

    // Create a new document in the CombinedModel
    const newDocument = new CombinedModel({
      subject_id,
      question_paper_url,
      answer_sheet_url,
      roll_number,
      assigned_to,
    });

    await newDocument.save();
    res.status(201).json({ message: "Document uploaded successfully", data: newDocument });
  } catch (error) {
    res.status(500).json({ message: "Error uploading document", error });
  }
});


app.get("/Que_Ans/assigned_to/:assigned_to", async (req, res) => {
  try {
    const { assigned_to } = req.params;
   
    // Find the document in the CombinedModel using the provided assigned_to
    const documents = await CombinedModel.find({ assigned_to });

    if (documents.length === 0) {
      return res.status(404).json({ message: "No documents found for the provided assigned_to" });
    }

    // Extracting necessary fields from the documents
    const result = documents.map(doc => ({
      _id:doc._id,
      Ans_Url:doc.answer_sheet_url,
      Ques_Url:doc.question_paper_url,
      roll_number: doc.roll_number,
      subject_id: doc.subject_id,
      assigned_to: doc.assigned_to,
      status: doc.status
    }));

    res.status(200).json({
      message: "Documents found",
      data: result
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving documents", error });
  }
});



app.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, marks } = req.body;

    console.log("Request data: ", status, marks);

    const updatedDocument = await CombinedModel.findByIdAndUpdate(
      id,
      { status, marks },  // Update status and marks
      { new: true }  // Return the updated document
    );

    if (!updatedDocument) {
      return res.status(404).json({ message: "Document not found" });
    }

    console.log("Updated document: ", updatedDocument);

    res.status(200).json({ message: "Document updated successfully", data: updatedDocument });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error updating document", error });
  }
});




app.post('/student/grade', async (req, res) => {
  try {
    const { roll_number, answers, totalMarks } = req.body;

    // Validate the data
    if (!roll_number || !answers || answers.length === 0 || !totalMarks) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Find the student by roll number
    const student = await Student.findOne({ roll_number });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Create the grading object
    const newGrading = new Grading({
      roll_number: roll_number,
      answers: answers,
      totalMarks: totalMarks,
    });

    // Save the grading to the database
    await newGrading.save();

    // Send a success response
    res.status(201).json({
      message: 'Grading added successfully',
      grading: newGrading,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Assuming CombinedModel is already imported
app.get("/students-overview", async (req, res) => {
  try {
    // Fetch all documents from the collection
    const allData = await CombinedModel.find();

    if (!allData || allData.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }

    res.status(200).json({ message: "Data retrieved successfully", data: allData });
  } catch (error) {
    res.status(500).json({ message: "Error fetching data", error });
  }
});


// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
