import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { inventoryTransactionsAPI } from "@/integrations/firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function Transactions() {
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      return await inventoryTransactionsAPI.getAllWithRelated();
    },
  });

  // ✅ Get unique recipients
  const recipients = useMemo(() => {
    if (!transactions) return [];
    const unique = new Set(
      transactions.map((t: any) => t.recipient_name).filter(Boolean)
    );
    return Array.from(unique);
  }, [transactions]);

  // ✅ Filter data
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (selectedRecipient === "all") return transactions;

    return transactions.filter(
      (t: any) => t.recipient_name === selectedRecipient
    );
  }, [transactions, selectedRecipient]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
            Transaction Log
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Audit trail of all inventory movements
          </p>
        </div>

        {/* Recipient Filter */}
        <div className="w-full md:w-auto">
          <select
            className="w-full md:w-auto border rounded-md px-3 py-2 text-xs sm:text-sm bg-background"
            value={selectedRecipient}
            onChange={(e) => setSelectedRecipient(e.target.value)}
            aria-label="Filter by recipient"
          >
            <option value="all">All Recipients</option>
            {recipients.map((r: string) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="hidden sm:block">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 sm:p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="min-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Type</TableHead>
                    <TableHead className="text-xs sm:text-sm">Serial</TableHead>
                    <TableHead className="hidden md:table-cell text-xs sm:text-sm">Category</TableHead>
                    <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Recipient</TableHead>
                    <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Modified By</TableHead>
                    <TableHead className="hidden xl:table-cell text-xs sm:text-sm max-w-[200px]">Notes</TableHead>
                    <TableHead className="text-xs sm:text-sm">Date & Time</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredTransactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs sm:text-sm">
                        <Badge
                          variant={
                            t.type === "addition" ? "default" : t.type === "revert" ? "secondary" : "destructive"
                          }
                          className="gap-1 text-xs"
                        >
                          {t.type === "addition" ? (
                            <ArrowDownToLine className="h-3 w-3" />
                          ) : t.type === "revert" ? (
                            <RefreshCw className="h-3 w-3" />
                          ) : (
                            <ArrowUpFromLine className="h-3 w-3" />
                          )}
                          <span className="hidden sm:inline">
                            {t.type === "addition" ? "Added" : t.type === "revert" ? "Reverted" : "Issued"}
                          </span>
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs sm:text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">
                            {t.inventory_items?.name ||
                              t.inventory_items?.serial_number}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {t.inventory_items?.serial_number}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                        {t.categories?.name || "—"}
                      </TableCell>

                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                        {t.recipient_name || "—"}
                      </TableCell>

                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm font-medium">
                        {t.created_by || "—"}
                      </TableCell>

                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {t.notes || "—"}
                      </TableCell>

                      <TableCell className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {format(
                          new Date(t.created_at),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 sm:py-12 text-center text-xs sm:text-sm text-muted-foreground">
              No transactions found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Loading...
          </div>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((t: any) => (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant={
                      t.type === "addition" ? "default" : t.type === "revert" ? "secondary" : "destructive"
                    }
                    className="gap-1 text-xs flex-shrink-0"
                  >
                    {t.type === "addition" ? (
                      <ArrowDownToLine className="h-3 w-3" />
                    ) : t.type === "revert" ? (
                      <RefreshCw className="h-3 w-3" />
                    ) : (
                      <ArrowUpFromLine className="h-3 w-3" />
                    )}
                    {t.type === "addition" ? "Added" : t.type === "revert" ? "Reverted" : "Issued"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(t.created_at), "MMM d, yyyy")}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground font-medium">Item</p>
                    <p className="font-medium truncate">
                      {t.inventory_items?.name ||
                        t.inventory_items?.serial_number}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs truncate">
                      {t.inventory_items?.serial_number}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground font-medium">Category</p>
                      <p className="truncate">{t.categories?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Recipient</p>
                      <p className="truncate">{t.recipient_name || "—"}</p>
                    </div>
                  </div>

                  {t.created_by && (
                    <div>
                      <p className="text-muted-foreground font-medium">Modified By</p>
                      <p className="truncate">{t.created_by}</p>
                    </div>
                  )}

                  {t.notes && (
                    <div>
                      <p className="text-muted-foreground font-medium">Notes</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}
