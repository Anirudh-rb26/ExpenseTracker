"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Users, Receipt, TrendingUp, TrendingDown, AlertCircle, Wifi, WifiOff } from "lucide-react"
import { CreateGroupModal } from "@/components/create-group-modal"
import { AddExpenseModal } from "@/components/add-expense-modal"
import type { Group, User } from "@/lib/type"

// Mock API service with enhanced error handling
const API_BASE_URL = "http://localhost:8000";

class APIError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchWithErrorHandling(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch {
        // If response is not JSON, use status text
      }

      throw new APIError(response.status, errorMessage, errorDetails);
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network or other errors
    throw new APIError(0, `Network error: ${error.message}`, error);
  }
}

const api = {
  async getUsers() {
    return fetchWithErrorHandling(`${API_BASE_URL}/users`);
  },

  async getGroups() {
    return fetchWithErrorHandling(`${API_BASE_URL}/groups`);
  },

  async getUserBalances(userId: number) {
    return fetchWithErrorHandling(`${API_BASE_URL}/users/${userId}/balances`);
  }
};

interface Balance {
  user_id: number;
  user_name: string;
  owes: Record<number, number>;
  owed_by: Record<number, number>;
  net_balance: number;
  group_id?: number;
}

type ErrorType = 'network' | 'server' | 'unknown';

interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: number;
}

const CURRENT_USER_ID = 1001;

// Add a DashboardGroup type for local use
interface DashboardGroup extends Group {
  users: User[];
  total_expenses: number;
}

// Type for group objects returned by the API
type ApiGroup = {
  id: number;
  name: string;
  users: User[];
  total_expenses: number;
};

export default function Dashboard() {
  const [groups, setGroups] = useState<DashboardGroup[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [userBalances, setUserBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AppError | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleError = useCallback((error: any): AppError => {
    console.error("Dashboard error:", error);

    if (error instanceof APIError) {
      return {
        type: error.status === 0 ? 'network' : 'server',
        message: error.message,
        details: error.details,
        timestamp: Date.now()
      };
    }

    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred',
      details: error,
      timestamp: Date.now()
    };
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Loading dashboard data...");

      // Load users and groups in parallel
      const [groupsData, usersData]: [any[], any[]] = await Promise.all([
        api.getGroups(),
        api.getUsers(),
      ]);

      // Transform groupsData to include user_ids for modal compatibility and keep users/total_expenses for dashboard
      // group and u are typed as any due to API response shape
      const groupsWithUserIds: DashboardGroup[] = (groupsData as ApiGroup[]).map((group) => ({
        ...group,
        user_ids: group.users.map((u: User) => u.id),
        users: group.users,
        total_expenses: group.total_expenses || 0,
      }));

      console.log("Groups data:", groupsWithUserIds);
      console.log("Users data:", usersData);

      setGroups(groupsWithUserIds);
      setUsers(usersData);

      // Load user balances only if groups exist
      if (groupsWithUserIds.length > 0) {
        try {
          const balancesData = await api.getUserBalances(CURRENT_USER_ID);
          console.log("Balances data:", balancesData);
          setUserBalances(balancesData);
        } catch (balanceError) {
          console.warn("Failed to load balances:", balanceError);
          setUserBalances([]);
          // Don't set main error for balance failures
        }
      } else {
        setUserBalances([]);
      }
    } catch (error) {
      setError(handleError(error));
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleGroupCreated = useCallback(() => {
    setShowCreateGroup(false);
    loadDashboardData();
  }, [loadDashboardData]);

  const handleExpenseAdded = useCallback(() => {
    setShowAddExpense(false);
    loadDashboardData();
  }, [loadDashboardData]);

  // Calculate totals from the balance data structure
  const totalOwed = userBalances.reduce((sum, balance) => {
    const owesAmount = Object.values(balance.owes).reduce((total, amount) => total + amount, 0);
    return sum + owesAmount;
  }, 0);

  const totalOwedTo = userBalances.reduce((sum, balance) => {
    const owedAmount = Object.values(balance.owed_by).reduce((total, amount) => total + amount, 0);
    return sum + owedAmount;
  }, 0);

  const netBalance = totalOwedTo - totalOwed;

  const getErrorIcon = (errorType: ErrorType) => {
    switch (errorType) {
      case 'network':
        return <WifiOff className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getRetryMessage = (errorType: ErrorType) => {
    switch (errorType) {
      case 'network':
        return "Check your internet connection and try again";
      case 'server':
        return "The server is experiencing issues. Please try again later";
      default:
        return "Something went wrong. Please try again";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-red-600 mb-4 flex items-center gap-2">
                {getErrorIcon(error.type)}
                <span className="font-semibold">Connection Error</span>
              </div>
              <p className="text-gray-500 text-center mb-2">{error.message}</p>
              <p className="text-sm text-gray-400 text-center mb-4">
                {getRetryMessage(error.type)}
              </p>
              <Button onClick={loadDashboardData} className="mb-4">
                Try Again
              </Button>
              {error.details && (
                <details className="text-xs text-gray-400 mt-4">
                  <summary className="cursor-pointer">Technical Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">SplitWise</h1>
              <div className="flex items-center gap-2 ml-4">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowAddExpense(true)}
                size="sm"
                disabled={!isOnline}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
              <Button
                onClick={() => setShowCreateGroup(true)}
                variant="outline"
                size="sm"
                disabled={!isOnline}
              >
                <Users className="w-4 h-4 mr-2" />
                New Group
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Offline Alert */}
        {!isOnline && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You're currently offline. Some features may not be available.
            </AlertDescription>
          </Alert>
        )}

        {/* Balance Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              {netBalance >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${Math.abs(netBalance).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {netBalance >= 0 ? "You are owed" : "You owe"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">You Owe</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">${totalOwed.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Across {userBalances.filter((b) => Object.keys(b.owes).length > 0).length} groups
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">You Are Owed</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalOwedTo.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Across {userBalances.filter((b) => Object.keys(b.owed_by).length > 0).length} groups
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Groups Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Groups</h2>
            <Badge variant="secondary">{groups.length} groups</Badge>
          </div>

          {groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
                <p className="text-gray-500 text-center mb-4">
                  Create your first group to start splitting expenses with friends
                </p>
                <Button
                  onClick={() => setShowCreateGroup(true)}
                  disabled={!isOnline}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card key={group.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Total Expenses</span>
                        <span className="font-medium">${group.total_expenses.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Members</span>
                        <span className="font-medium">{group.users.length}</span>
                      </div>
                      <div className="flex -space-x-2">
                        {group.users.slice(0, 3).map((user: User) => (
                          <Avatar key={user.id} className="w-8 h-8 border-2 border-white">
                            <AvatarFallback className="text-xs">
                              {user.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {group.users.length > 3 && (
                          <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                            <span className="text-xs text-gray-600">+{group.users.length - 3}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setShowAddExpense(true);
                        }}
                        disabled={!isOnline}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Expense
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {userBalances.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Balances</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {userBalances.slice(0, 5).map((balance, index) => (
                    <div key={index} className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {balance.user_name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">Group Balance</p>
                          <p className="text-sm text-gray-500">Net balance</p>
                        </div>
                      </div>
                      <div className={`font-semibold ${balance.net_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {balance.net_balance >= 0 ? "+" : ""}${balance.net_balance.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Mock Modals - In real implementation, these would be actual modal components */}
      <CreateGroupModal
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        users={users}
        onGroupCreated={handleGroupCreated}
      />
      <AddExpenseModal
        open={showAddExpense}
        onOpenChange={(open) => {
          setShowAddExpense(open);
          if (!open) setSelectedGroupId(null);
        }}
        groups={groups as Group[]}
        users={users}
        selectedGroupId={selectedGroupId}
        onExpenseAdded={handleExpenseAdded}
      />
    </div>
  );
}