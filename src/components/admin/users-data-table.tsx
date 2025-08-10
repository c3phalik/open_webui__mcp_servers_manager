"use client"

import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowUpDown,
  ChevronDown,
  MoreVertical,
  Search,
  User,
  Shield,
  Calendar,
  Server,
  Edit,
  Key,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { PasswordDisplay } from './password-display'

interface UserData {
  id: string
  email: string
  name?: string
  role: string
  emailVerified: boolean
  createdAt: string
  _count: {
    mcpServers: number
  }
}

interface UsersDataTableProps {
  data: UserData[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  onPageChange: (page: number) => void
  onSearch: (query: string) => void
  searchQuery: string
  isLoading: boolean
  onEditUser: (user: UserData) => void
  onResetPassword: (user: UserData) => void
  onDeleteUser: (user: UserData) => void
  showPasswordFor?: string | null
  generatedPassword?: string
}

export function UsersDataTable({
  data,
  pagination,
  onPageChange,
  onSearch,
  searchQuery,
  isLoading,
  onEditUser,
  onResetPassword,
  onDeleteUser,
  showPasswordFor,
  generatedPassword,
}: UsersDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const columns: ColumnDef<UserData>[] = [
    {
      accessorKey: 'email',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 hover:bg-transparent"
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{user.email}</span>
                {user.role === 'admin' && (
                  <Badge variant="default" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
                {!user.emailVerified && (
                  <Badge variant="outline">Unverified</Badge>
                )}
              </div>
              {user.name && (
                <p className="text-sm text-muted-foreground">{user.name}</p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.getValue('role') as string
        return role === 'admin' ? (
          <Badge variant="default" className="gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        ) : (
          <Badge variant="secondary">User</Badge>
        )
      },
    },
    {
      accessorKey: '_count.mcpServers',
      header: 'Servers',
      cell: ({ row }) => {
        const count = row.original._count.mcpServers
        return (
          <div className="flex items-center gap-1 text-sm">
            <Server className="h-3 w-3 text-muted-foreground" />
            {count}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 hover:bg-transparent"
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(row.getValue('createdAt')).toLocaleDateString()}
          </div>
        )
      },
    },
    {
      id: 'password',
      header: 'Password',
      cell: ({ row }) => {
        const user = row.original
        return showPasswordFor === user.id && generatedPassword ? (
          <div className="max-w-xs">
            <PasswordDisplay 
              password={generatedPassword}
              label="New Password"
              className="text-xs"
            />
          </div>
        ) : null
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const user = row.original
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEditUser(user)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResetPassword(user)}>
                <Key className="h-4 w-4 mr-2" />
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDeleteUser(user)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    pageCount: pagination.pages,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {pagination.total} users total
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {searchQuery ? 'No users found matching your search' : 'No users found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}