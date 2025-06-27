"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Receipt, Plus, Loader2, Users, Calculator } from "lucide-react"
import type { Group, User } from "@/lib/types"
import { api } from "@/lib/api"

interface AddExpenseModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    groups: Group[]
    users: User[]
    selectedGroupId?: number | null
    onExpenseAdded: () => void
}

interface Split {
    user_id: number
    percentage?: number
}

export function AddExpenseModal({
    open,
    onOpenChange,
    groups,
    users,
    selectedGroupId,
    onExpenseAdded,
}: AddExpenseModalProps) {
    const [description, setDescription] = useState("")
    const [amount, setAmount] = useState("")
    const [groupId, setGroupId] = useState<string>(selectedGroupId?.toString() || "")
    const [paidBy, setPaidBy] = useState<string>("1001") // Default to current user
    const [splitType, setSplitType] = useState<"equal" | "percentage">("equal")
    const [splits, setSplits] = useState<Split[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Reset form when modal opens/closes
    useEffect(() => {
        if (open) {
            setDescription("")
            setAmount("")
            setGroupId(selectedGroupId?.toString() || "")
            setPaidBy("1001")
            setSplitType("equal")
            setSplits([])
            setError("")
        }
    }, [open, selectedGroupId])

    // Update splits when group or split type changes
    useEffect(() => {
        if (groupId) {
            const group = groups.find((g) => g.id === Number.parseInt(groupId))
            if (group) {
                const groupUsers = users.filter((user) => group.user_ids.includes(user.id))
                if (splitType === "equal") {
                    setSplits(groupUsers.map((user) => ({ user_id: user.id })))
                } else {
                    const equalPercentage = Math.floor(100 / groupUsers.length)
                    const remainder = 100 - equalPercentage * groupUsers.length
                    setSplits(
                        groupUsers.map((user, index) => ({
                            user_id: user.id,
                            percentage: index === 0 ? equalPercentage + remainder : equalPercentage,
                        })),
                    )
                }
            }
        }
    }, [groupId, splitType, groups, users])

    const selectedGroup = groups.find((g) => g.id === Number.parseInt(groupId))
    const groupUsers = selectedGroup ? users.filter((user) => selectedGroup.user_ids.includes(user.id)) : []
    const totalPercentage = splits.reduce((sum, split) => sum + (split.percentage || 0), 0)

    const handlePercentageChange = (userId: number, percentage: string) => {
        const numPercentage = Number.parseFloat(percentage) || 0
        setSplits((prev) =>
            prev.map((split) => (split.user_id === userId ? { ...split, percentage: numPercentage } : split)),
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!description.trim()) {
            setError("Description is required")
            return
        }

        if (!amount || Number.parseFloat(amount) <= 0) {
            setError("Please enter a valid amount")
            return
        }

        if (!groupId) {
            setError("Please select a group")
            return
        }

        if (!paidBy) {
            setError("Please select who paid")
            return
        }

        if (splitType === "percentage" && Math.abs(totalPercentage - 100) > 0.01) {
            setError("Percentages must add up to 100%")
            return
        }

        try {
            setLoading(true)
            setError("")

            await api.addExpense(Number.parseInt(groupId), {
                description: description.trim(),
                amount: Number.parseFloat(amount),
                paid_by: Number.parseInt(paidBy),
                split_type: splitType,
                splits: splits,
            })

            onExpenseAdded()
        } catch (error) {
            setError("Failed to add expense. Please try again.")
            console.error("Failed to add expense:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <Receipt className="w-5 h-5" />
                        <span>Add New Expense</span>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What was this expense for?"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount ($)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Group Selection */}
                    <div className="space-y-2">
                        <Label>Group</Label>
                        <Select value={groupId} onValueChange={setGroupId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a group" />
                            </SelectTrigger>
                            <SelectContent>
                                {groups.map((group) => (
                                    <SelectItem key={group.id} value={group.id.toString()}>
                                        <div className="flex items-center space-x-2">
                                            <Users className="w-4 h-4" />
                                            <span>{group.name}</span>
                                            <span className="text-sm text-gray-500">
                                                ({users.filter((u) => group.user_ids.includes(u.id)).length} members)
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Paid By */}
                    {selectedGroup && (
                        <div className="space-y-2">
                            <Label>Paid by</Label>
                            <Select value={paidBy} onValueChange={setPaidBy}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Who paid for this?" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groupUsers.map((user) => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                            <div className="flex items-center space-x-2">
                                                <Avatar className="w-5 h-5">
                                                    <AvatarFallback className="text-xs">
                                                        {user.name
                                                            .split(" ")
                                                            .map((n) => n[0])
                                                            .join("")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span>{user.name}</span>
                                                {user.id === 1001 && <span className="text-sm text-gray-500">(You)</span>}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Split Type */}
                    {selectedGroup && (
                        <div className="space-y-4">
                            <Label>How should this be split?</Label>
                            <RadioGroup value={splitType} onValueChange={(value: "equal" | "percentage") => setSplitType(value)}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="equal" id="equal" />
                                    <Label htmlFor="equal">Split equally among all members</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="percentage" id="percentage" />
                                    <Label htmlFor="percentage">Custom percentages</Label>
                                </div>
                            </RadioGroup>

                            {/* Split Preview */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between text-base">
                                        <div className="flex items-center space-x-2">
                                            <Calculator className="w-4 h-4" />
                                            <span>Split Details</span>
                                        </div>
                                        {splitType === "percentage" && (
                                            <span
                                                className={`text-sm ${Math.abs(totalPercentage - 100) < 0.01 ? "text-green-600" : "text-red-600"}`}
                                            >
                                                Total: {totalPercentage.toFixed(1)}%
                                            </span>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {splits.map((split) => {
                                        const user = users.find((u) => u.id === split.user_id)
                                        const userAmount =
                                            splitType === "equal"
                                                ? Number.parseFloat(amount || "0") / splits.length
                                                : (Number.parseFloat(amount || "0") * (split.percentage || 0)) / 100

                                        return (
                                            <div key={split.user_id} className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarFallback className="text-xs">
                                                            {user?.name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("") || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">
                                                        {user?.name}
                                                        {user?.id === 1001 && <span className="text-sm text-gray-500 ml-1">(You)</span>}
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {splitType === "percentage" && (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={split.percentage || 0}
                                                            onChange={(e) => handlePercentageChange(split.user_id, e.target.value)}
                                                            className="w-20 text-center"
                                                        />
                                                    )}
                                                    <span className="font-semibold min-w-[60px] text-right">${userAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

                    {/* Actions */}
                    <div className="flex justify-end space-x-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                loading ||
                                !description.trim() ||
                                !amount ||
                                !groupId ||
                                (splitType === "percentage" && Math.abs(totalPercentage - 100) > 0.01)
                            }
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Expense
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
