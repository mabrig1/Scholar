type PrintOption = "DIGITAL_ONLY" | "PRINT_ONLY" | "DIGITAL_AND_PRINT" | "DIGITAL_PRINT_DELIVERY";
type PrintType = "BLACK_WHITE" | "COLOUR";
type BindingType = "NONE" | "SPIRAL" | "SOFT" | "HARD";

const serviceBase: Record<string, number> = {
  "Academic Document Printing": 1000,
  "Project & Thesis Formatting": 5000,
  "Research Assistance": 5000,
  "Assignment & Term-Paper Support": 3000,
  "Data Analysis Assistance": 7500,
  "Printing & Binding": 1000,
  "Campus Delivery": 1500,
};

export function calculateQuote(input: {
  service: string;
  printOption: PrintOption;
  printType: PrintType;
  copies: number;
  pages: number;
  binding: BindingType;
  delivery: boolean;
}) {
  let total = serviceBase[input.service] ?? 3000;
  if (input.printOption !== "DIGITAL_ONLY") {
    const perPage = input.printType === "COLOUR" ? 100 : 30;
    total += input.pages * input.copies * perPage;
    if (input.binding === "SPIRAL") total += 1500 * input.copies;
    if (input.binding === "SOFT") total += 2500 * input.copies;
    if (input.binding === "HARD") total += 5000 * input.copies;
  }
  if (input.delivery) total += 1500;
  return Math.max(total, 1000);
}
