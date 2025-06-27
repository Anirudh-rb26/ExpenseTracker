"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/seperator"
import { Plus, Receipt, Users, ArrowRight, RefreshCw, DollarSign } from "lucide-react"
import type { Group, GroupDetail, User, Balance, Expense } from "@/lib/type"
import { api } from "@/lib/api"

interface GroupDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    group: Group & { users?: User[]; total_expenses?: number }
    groupDetail: GroupDetail | null
    users: User[]
    balances: Balance[]
    currentUserId: number
    onAddExpense: () => void
    onRefresh: () => void
}

export function GroupDetailModal({
    open,
    onOpenChange,
    group,
    groupDetail,
    users,
    balances,
    currentUserId,
    onAddExpense,
    onRefresh,
}: GroupDetailModalProps) {
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && group.id) {
            loadExpenses()
        }
    }, [open, group.id])

    const loadExpenses = async () => {
        try {
            setLoading(true)
            const expensesData = await api.getGroupExpenses(group.id)
            setExpenses(expensesData)
        } catch (error) {
            console.error("Failed to load expenses:", error)
        } finally {
            setLoading(false)
        }
    }

    const groupUsers = group.users || users.filter((user) => (group.user_ids || []).includes(user.id))
    const userBalance = balances.find((b) => b.user_id === currentUserId)

    const settlements = balances
        .filter((b) => (b.amount || 0) !== 0)
        .map((balance) => {
            const user = users.find((u) => u.id === balance.user_id)
            const otherUser = users.find((u) => u.id === balance.other_user_id)
            return {
                from: (balance.amount || 0) < 0 ? user : otherUser,
                to: (balance.amount || 0) < 0 ? otherUser : user,
                amount: Math.abs(balance.amount || 0),
            }
        })
        .filter((s) => s.from && s.to)
        .slice(0, 3)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full overflow-hidden">
                <DialogHeader className="pb-6 border-b">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-3xl font-bold text-gray-900 truncate">
                                {group.name || "Unnamed Group"}
                            </DialogTitle>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <Button variant="outline" size="sm" onClick={onRefresh} className="whitespace-nowrap bg-transparent">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <Button onClick={onAddExpense} size="sm" className="whitespace-nowrap">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Expense
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex flex-col h-full overflow-hidden p-2">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <Card className="border-l-4 border-l-blue-500">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            ${(group.total_expenses || groupDetail?.total_expenses || 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <DollarSign className="w-8 h-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-green-500">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Your Balance</p>
                                        <p
                                            className={`text-2xl font-bold ${userBalance && (userBalance.amount || 0) >= 0 ? "text-green-600" : "text-red-600"
                                                }`}
                                        >
                                            {userBalance
                                                ? `${(userBalance.amount || 0) >= 0 ? "+" : ""}$${Math.abs(userBalance.amount || 0).toFixed(2)}`
                                                : "$0.00"}
                                        </p>
                                    </div>
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center ${userBalance && (userBalance.amount || 0) >= 0 ? "bg-green-100" : "bg-red-100"
                                            }`}
                                    >
                                        <ArrowRight
                                            className={`w-4 h-4 ${userBalance && (userBalance.amount || 0) >= 0
                                                ? "text-green-600 rotate-45"
                                                : "text-red-600 -rotate-45"
                                                }`}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-purple-500">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Members</p>
                                        <p className="text-2xl font-bold text-gray-900">{groupUsers.length}</p>
                                    </div>
                                    <Users className="w-8 h-8 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-8 flex-1 overflow-hidden min-h-0">
                        {/* Left Column - Members and Settlements */}
                        <div className="xl:col-span-1 space-y-6 overflow-y-auto">
                            {/* Members */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Group Members</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {groupUsers.map((user, index) => {
                                        const balance = balances.find((b) => b.user_id === user.id)
                                        return (
                                            <div key={user.id}>
                                                <div className="flex items-center justify-between py-2">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-10 h-10">
                                                            <AvatarFallback className="text-sm font-medium">
                                                                {(user.name || "?")
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium text-gray-900">
                                                                {user.name || "Unknown User"}
                                                                {user.id === currentUserId && (
                                                                    <span className="text-xs text-blue-600 ml-2 font-normal">(You)</span>
                                                                )}
                                                            </p>
                                                            <p className="text-sm text-gray-500">{user.email || "No email"}</p>
                                                        </div>
                                                    </div>
                                                    {balance && (
                                                        <Badge
                                                            variant={(balance.amount || 0) >= 0 ? "default" : "destructive"}
                                                            className={
                                                                (balance.amount || 0) >= 0
                                                                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                                                                    : "bg-red-100 text-red-800 hover:bg-red-100"
                                                            }
                                                        >
                                                            {(balance.amount || 0) >= 0 ? "+" : ""}${Math.abs(balance.amount || 0).toFixed(2)}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {index < groupUsers.length - 1 && <Separator />}
                                            </div>
                                        )
                                    })}
                                </CardContent>
                            </Card>

                            {/* Settlement Suggestions */}
                            {settlements.length > 0 && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg">Suggested Settlements</CardTitle>
                                        <p className="text-sm text-gray-600">Simplify your group's debts</p>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {settlements.map((settlement, index) => (
                                            <div
                                                key={index}
                                                className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-8 h-8">
                                                            <AvatarFallback className="text-xs">
                                                                {(settlement.from?.name || "?")
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <ArrowRight className="w-4 h-4 text-blue-600" />
                                                        <Avatar className="w-8 h-8">
                                                            <AvatarFallback className="text-xs">
                                                                {(settlement.to?.name || "?")
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium">
                                                                {settlement.from?.name} owes {settlement.to?.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                                        ${settlement.amount.toFixed(2)}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Right Column - Expenses */}
                        <div className="xl:col-span-2 overflow-hidden">
                            <Card className="h-full flex flex-col">
                                <CardHeader className="pb-4 flex-shrink-0">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xl">Recent Expenses</CardTitle>
                                        {expenses.length > 0 && (
                                            <Badge variant="secondary" className="text-sm">
                                                {expenses.length} total
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto px-6">
                                    {loading ? (
                                        <div className="space-y-4">
                                            {[1, 2, 3].map((i) => (
                                                <div key={i} className="animate-pulse">
                                                    <div className="h-16 bg-gray-200 rounded-lg"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : expenses.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-500 font-medium">No expenses yet</p>
                                            <p className="text-sm text-gray-400">Add your first expense to get started</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {expenses.slice(0, 10).map((expense, index) => {
                                                const paidByUser = users.find((u) => u.id === expense.paid_by)
                                                const expenseDate = expense.created_at
                                                    ? new Date(expense.created_at).toLocaleDateString()
                                                    : "Unknown date"

                                                return (
                                                    <div key={expense.id}>
                                                        <div className="py-4">
                                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                    <Avatar className="w-10 h-10 flex-shrink-0">
                                                                        <AvatarFallback className="text-sm">
                                                                            {(paidByUser?.name || "?")
                                                                                .split(" ")
                                                                                .map((n) => n[0])
                                                                                .join("")}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-semibold text-gray-900 truncate text-lg">
                                                                            {expense.description || "No description"}
                                                                        </p>
                                                                        <p className="text-sm text-gray-500 truncate">
                                                                            Paid by {paidByUser?.name || "Unknown"}
                                                                            {expense.paid_by === currentUserId && " (You)"} • {expenseDate}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right flex-shrink-0">
                                                                    <p className="font-bold text-xl text-gray-900">${(expense.amount || 0).toFixed(2)}</p>
                                                                    <Badge variant="outline" className="text-xs mt-1">
                                                                        {expense.split_type || "equal"}
                                                                    </Badge>
                                                                </div>
                                                            </div>

                                                            <div className="ml-13 text-sm text-gray-600">
                                                                Split equally among {groupUsers.length} members
                                                                <span className="ml-2 font-semibold text-green-600">
                                                                    ${((expense.amount || 0) / groupUsers.length).toFixed(2)} each
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {index < Math.min(expenses.length, 10) - 1 && <Separator />}
                                                    </div>
                                                )
                                            })}

                                            {expenses.length > 10 && (
                                                <div className="text-center pt-4 border-t">
                                                    <p className="text-sm text-gray-500">Showing 10 of {expenses.length} expenses</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
