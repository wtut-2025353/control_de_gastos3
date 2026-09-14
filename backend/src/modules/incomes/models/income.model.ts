import { Schema, model, type InferSchemaType } from "mongoose";

const incomeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      enum: ["salario", "freelance", "inversiones", "regalos", "otros"],
      default: "otros"
    },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

incomeSchema.index({ user: 1, date: -1 });

export type IncomeDoc = InferSchemaType<typeof incomeSchema>;
export const Income = model("Income", incomeSchema);
