import mongoose from "mongoose";

const problemSchema = new mongoose.Schema({
    company: String,
    problem_slug: String
  });
  
export const Problem = mongoose.model('Problem', problemSchema);
  