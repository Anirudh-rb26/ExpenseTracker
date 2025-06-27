"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Plus, Loader2 } from "lucide-react"
import type { User } from "@/lib/type"
import { api } from "@/lib/api"

interface CreateGroupModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    users: User[]
    onGroupCreated: () => void
}

export function CreateGroupModal({ open, onOpenChange, users, onGroupCreated }: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState("")
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([1001]) // Always include current user
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Reset form only when modal is closed
    useEffect(() => {
        if (!open) {
            setGroupName("")
            setSelectedUserIds([1001])
            setError("")
        }
    }, [open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!groupName.trim()) {
            setError("Group name is required")
            return
        }

        if (selectedUserIds.length < 2) {
            setError("Please select at least one other member")
            return
        }

        try {
            setLoading(true)
            setError("")

            await api.createGroup({
                name: groupName.trim(),
                user_ids: selectedUserIds,
            })

            // Reset form
            // setGroupName("")
            // setSelectedUserIds([1001])
            onGroupCreated()
        } catch (error) {
            setError("Failed to create group. Please try again.")
            console.error("Failed to create group:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleUserToggle = (userId: number) => {
        if (userId === 1001) return // Can't deselect current user

        setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
    }

    const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <Users className="w-5 h-5" />
                        <span>Create New Group</span>
                    </DialogTitle>
                </DialogHeader>
                <DialogDescription className="mb-4">
                    Create a group to split expenses with selected members. You must select at least one other member.
                </DialogDescription>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Group Name */}
                    <div className="space-y-2">
                        <Label htmlFor="groupName">Group Name</Label>
                        <Input
                            id="groupName"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name (e.g., 'Weekend Trip', 'Roommates')"
                            className="w-full"
                        />
                    </div>

                    {/* Member Selection */}
                    <div className="space-y-4">
                        <Label>Select Members</Label>

                        {/* Selected Members Preview */}
                        {selectedUsers.length > 0 && (
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <Users className="w-4 h-4 text-gray-500" />
                                        <span className="text-sm font-medium">Selected Members ({selectedUsers.length})</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedUsers.map((user) => (
                                            <div
                                                key={user.id}
                                                className="flex items-center space-x-2 bg-teal-50 text-teal-800 px-3 py-1 rounded-full text-sm"
                                            >
                                                <Avatar className="w-5 h-5">
                                                    <AvatarFallback className="text-xs">
                                                        {user.name
                                                            .split(" ")
                                                            .map((n: string) => n[0])
                                                            .join("")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span>{user.name}</span>
                                                {user.id === 1001 && <span className="text-xs">(You)</span>}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Available Users */}
                        <div className="max-h-64 overflow-y-auto border rounded-lg">
                            <div className="p-2 space-y-1">
                                {users.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={selectedUserIds.includes(user.id)}
                                            disabled={user.id === 1001} // Current user always selected
                                            onCheckedChange={() => handleUserToggle(user.id)}
                                        />
                                        <Avatar className="w-8 h-8">
                                            <AvatarFallback className="text-xs">
                                                {user.name
                                                    .split(" ")
                                                    .map((n: string) => n[0])
                                                    .join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <p className="font-medium">
                                                {user.name}
                                                {user.id === 1001 && <span className="text-sm text-gray-500 ml-1">(You)</span>}
                                            </p>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

                    {/* Actions */}
                    <div className="flex justify-end space-x-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !groupName.trim() || selectedUserIds.length < 2}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Group
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
