import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Settings } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccountView } from './AccountView'; 
import { PreferencesForm } from './PreferencesForm';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NavItem = ({ icon: Icon, label, isActive, onClick }) => (
  <Button
    variant={isActive ? 'secondary' : 'ghost'}
    onClick={onClick}
    className="w-full justify-start gap-2"
  >
    <Icon className="h-4 w-4" />
    <span>{label}</span>
  </Button>
);

export const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
  const [activeTab, setActiveTab] = useState<'account' | 'preferences'>('account');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[70vh] p-0 flex flex-col">
        {/* Header Section */}
        <DialogHeader className="p-4 border-b text-left">
          <DialogTitle>My Profile</DialogTitle>
        </DialogHeader>

        {/* Main Body with Sidebar and Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-[220px] bg-muted/50 border-r p-4 flex flex-col gap-1">
            <NavItem 
              icon={User}
              label="Account"
              isActive={activeTab === 'account'}
              onClick={() => setActiveTab('account')}
            />
            <NavItem 
              icon={Settings}
              label="Preferences"
              isActive={activeTab === 'preferences'}
              onClick={() => setActiveTab('preferences')}
            />
          </div>

          {/* Scrollable Main Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {activeTab === 'account' && <AccountView />}
              {activeTab === 'preferences' && <PreferencesForm />}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};