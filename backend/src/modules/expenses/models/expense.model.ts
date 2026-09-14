import { Schema, model, type InferSchemaType } from "mongoose";

const expenseSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      enum: ["alimentos", "transporte", "hogar", "entretenimiento", "salud", "educacion", "otros"],
      default: "otros"
    },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema>;
export const Expense = model("Expense", expenseSchema);
