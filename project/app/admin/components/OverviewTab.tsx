'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { Award, CheckCircle, FileText } from 'lucide-react';
import { AuctionItem } from '@/types/auction';
import { dataStore } from '@/services/dataStore';
import { getStatusColor } from './statusUtils';

interface OverviewTabProps {
  items: AuctionItem[];
  onSwitchTab: (tab: string) => void;
}

export default function OverviewTab({ items, onSwitchTab }: OverviewTabProps) {
  const productionStatus = dataStore.getProductionStatus();

  return (
    <TabsContent value="overview" className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">System Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Production Status</CardTitle>
            <Award className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="space-y-1">
                <div className={`text-xs px-2 py-1 rounded-full ${productionStatus.isClean ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {productionStatus.isClean ? 'Clean' : 'Has Data'}
                </div>
                <div className="text-xs text-gray-500">
                  {productionStatus.userCount} users, {productionStatus.itemCount} items
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.itemName}</p>
                    <p className="text-xs text-gray-500">{item.status}</p>
                  </div>
                  <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => onSwitchTab('workflow')}>
                <FileText className="mr-2 h-4 w-4" />
                View Item Pipeline
              </Button>
              <Button variant="outline" className="w-full" onClick={() => onSwitchTab('finalized')}>
                <CheckCircle className="mr-2 h-4 w-4" />
                View Finalized Items
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
