export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Group {
  id: number;
  name: string;
  user_ids: number[];
}

export interface GroupDetail {
  id: number;
  name: string;
  user_ids: number[];
  total_expenses: number;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  paid_by: number;
  split_type: "equal" | "percentage";
  group_id: number;
  created_at: string;
}

export interface Balance {
  user_id: number;
  other_user_id: number;
  amount: number;
  group_id?: number;
  net_balance?: number;
  user_name?: string;
}

export interface Split {
  user_id: number;
  percentage?: number;
}
