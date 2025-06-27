"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Plus, Receipt, Users, ArrowRight, RefreshCw } from "lucide-react"
import type { Group, GroupDetail, User, Balance, Expense } from "@/lib/types"
import { api } from "@/lib/api"

interface GroupDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    group: Group
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

    const groupUsers = users.filter((user) => group.user_ids.includes(user.id))
    const userBalance = balances.find((b) => b.user_id === currentUserId)

    // Calculate settlement suggestions
    const settlements = balances
        .filter((b) => b.amount !== 0)
        .map((balance) => {
            const user = users.find((u) => u.id === balance.user_id)
            const otherUser = users.find((u) => u.id === balance.other_user_id)
            return {
                from: balance.amount < 0 ? user : otherUser,
                to: balance.amount < 0 ? otherUser : user,
                amount: Math.abs(balance.amount),
            }
        })
        .filter((s) => s.from && s.to)
        .slice(0, 3) // Show top 3 settlements

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl font-bold">{group.name}</DialogTitle>
                        <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={onRefresh}>
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button onClick={onAddExpense} size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Expense
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Group Info & Members */}
                    <div className="space-y-6">
                        {/* Group Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <Receipt className="w-5 h-5" />
                                    <span>Group Summary</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Total Expenses</span>
                                    <span className="font-semibold">${groupDetail?.total_expenses.toFixed(2) || "0.00"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Your Balance</span>
                                    <Badge
                                        variant={userBalance && userBalance.amount >= 0 ? "default" : "destructive"}
                                        className={
                                            userBalance && userBalance.amount >= 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""
                                        }
                                    >
                                        {userBalance ? `${userBalance.amount >= 0 ? "+" : ""}$${userBalance.amount.toFixed(2)}` : "$0.00"}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Members */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <Users className="w-5 h-5" />
                                    <span>Members ({groupUsers.length})</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {groupUsers.map((user) => {
                                        const balance = balances.find((b) => b.user_id === user.id)
                                        return (
                                            <div key={user.id} className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarFallback className="text-xs">
                                                            {user.name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">
                                                            {user.name}
                                                            {user.id === currentUserId && <span className="text-sm text-gray-500 ml-1">(You)</span>}
                                                        </p>
                                                        <p className="text-sm text-gray-500">{user.email}</p>
                                                    </div>
                                                </div>
                                                {balance && (
                                                    <Badge
                                                        variant={balance.amount >= 0 ? "default" : "destructive"}
                                                        className={balance.amount >= 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                                                    >
                                                        {balance.amount >= 0 ? "+" : ""}${balance.amount.toFixed(2)}
                                                    </Badge>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Expenses & Settlements */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Settlement Suggestions */}
                        {settlements.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Settlement Suggestions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {settlements.map((settlement, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarFallback className="text-xs">
                                                            {settlement.from?.name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("") || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarFallback className="text-xs">
                                                            {settlement.to?.name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("") || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm">
                                                            <span className="font-medium">{settlement.from?.name}</span> should pay{" "}
                                                            <span className="font-medium">{settlement.to?.name}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="font-semibold">
                                                    ${settlement.amount.toFixed(2)}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Recent Expenses */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Expenses</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="animate-pulse">
                                                <div className="h-16 bg-gray-200 rounded-lg"></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : expenses.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-500">No expenses yet</p>
                                        <p className="text-sm text-gray-400">Add your first expense to get started</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {expenses.slice(0, 10).map((expense) => {
                                            const paidByUser = users.find((u) => u.id === expense.paid_by)
                                            return (
                                                <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                    <div className="flex items-center space-x-3">
                                                        <Avatar className="w-10 h-10">
                                                            <AvatarFallback className="text-xs">
                                                                {paidByUser?.name
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("") || "?"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{expense.description}</p>
                                                            <p className="text-sm text-gray-500">
                                                                Paid by {paidByUser?.name || "Unknown"}
                                                                {expense.paid_by === currentUserId && " (You)"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-semibold">${expense.amount.toFixed(2)}</p>
                                                        <p className="text-xs text-gray-500 capitalize">{expense.split_type} split</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
