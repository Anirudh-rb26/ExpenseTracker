"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Receipt, Eye } from "lucide-react"
import type { Group, User, GroupDetail, Balance } from "@/lib/type"
import { api } from "@/lib/api"
import { GroupDetailModal } from "./group-detail-modal"

interface GroupCardProps {
    group: Group & { users?: User[]; total_expenses?: number }
    users: User[]
    currentUserId: number
    onAddExpense: (groupId: number) => void
}

export function GroupCard({ group, users, currentUserId, onAddExpense }: GroupCardProps) {
    const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
    const [balances, setBalances] = useState<Balance[]>([])
    const [showDetail, setShowDetail] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadGroupData()
    }, [group.id])

    const loadGroupData = async () => {
        try {
            setLoading(true)
            const [detailData, balanceData] = await Promise.all([
                api.getGroupDetail(group.id),
                api.getGroupBalances(group.id),
            ])
            setGroupDetail(detailData)
            setBalances(balanceData)
        } catch (error) {
            console.error("Failed to load group data:", error)
        } finally {
            setLoading(false)
        }
    }

    // Use group.users if available (from dashboard), otherwise filter from users prop
    const groupUsers = group.users || users.filter((user) => (group.user_ids || []).includes(user.id))
    const userBalance = balances.find((b) => b.user_id === currentUserId)
    const totalExpenses = group.total_expenses || groupDetail?.total_expenses || 0

    return (
        <>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold truncate">{group.name || "Unnamed Group"}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Users className="w-4 h-4" />
                        <span>{groupUsers.length} members</span>
                        <span>•</span>
                        <Receipt className="w-4 h-4" />
                        <span>${totalExpenses.toFixed(2)} total</span>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Member Avatars */}
                    <div className="flex -space-x-2">
                        {groupUsers.slice(0, 4).map((user) => (
                            <Avatar key={user.id} className="w-8 h-8 border-2 border-white">
                                <AvatarFallback className="text-xs">
                                    {(user.name || "?")
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                        {groupUsers.length > 4 && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-600">+{groupUsers.length - 4}</span>
                            </div>
                        )}
                    </div>

                    {/* Balance Status */}
                    {userBalance && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Your balance:</span>
                            <Badge
                                variant={(userBalance.amount || 0) >= 0 ? "default" : "destructive"}
                                className={(userBalance.amount || 0) >= 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                            >
                                {(userBalance.amount || 0) >= 0 ? "+" : ""}${(userBalance.amount || 0).toFixed(2)}
                            </Badge>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-transparent"
                            onClick={(e) => {
                                e.stopPropagation()
                                onAddExpense(group.id)
                            }}
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Expense
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowDetail(true)
                            }}
                        >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <GroupDetailModal
                open={showDetail}
                onOpenChange={setShowDetail}
                group={group}
                groupDetail={groupDetail}
                users={users}
                balances={balances}
                currentUserId={currentUserId}
                onAddExpense={() => {
                    setShowDetail(false)
                    onAddExpense(group.id)
                }}
                onRefresh={loadGroupData}
            />
        </>
    )
}
