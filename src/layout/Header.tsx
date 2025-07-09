import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import {
    AppBar,
    Box,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Tab,
    Tabs,
    Toolbar,
    Typography,
} from '@mui/material';
import {
    CanAccess,
    LoadingIndicator,
    Logout,
    UserMenu,
    useUserMenu,
} from 'react-admin';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useConfigurationContext } from '../root/ConfigurationContext';

const Header = () => {
    const { logo, title } = useConfigurationContext();
    const location = useLocation();

    let currentPath: string | boolean = '/';
    if (!!matchPath('/', location.pathname)) {
        currentPath = '/';
    } else if (!!matchPath('/contacts/*', location.pathname)) {
        currentPath = '/contacts';
    } else if (!!matchPath('/companies/*', location.pathname)) {
        currentPath = '/companies';
    } else if (!!matchPath('/deals/*', location.pathname)) {
        currentPath = '/deals';
    } else {
        currentPath = false;
    }

    return (
        <Box component="nav" sx={{ flexGrow: 1 }}>
            <AppBar position="static" color="primary" sx={{ backgroundColor: '#5E35B1' }}>
                <Toolbar variant="dense" sx={{ alignItems: 'center', minHeight: 0 }}>
                    <Box flex={1} display="flex" justifyContent="space-between" alignItems="center">
                        <Box
                            display="flex"
                            alignItems="center"
                            component={Link}
                            to="/"
                            sx={{
                                color: 'inherit',
                                textDecoration: 'inherit',
                            }}
                            gap={1.5}
                        >
                            <Box
                                component="img"
                                sx={{ height: 100 }}
                                src={logo}
                                alt="Engagement Management"
                            />
                            <Typography component="span" variant="h5">
                                Engagement Management
                            </Typography>
                        </Box>
                        <Box>
                            <Tabs
                                value={currentPath}
                                aria-label="Navigation Tabs"
                                indicatorColor="secondary"
                                textColor="inherit"
                            >
                                <Tab
                                    label={'Dashboard'}
                                    component={Link}
                                    to="/"
                                    value="/"
                                />
                                <Tab
                                    label={'Contacts'}
                                    component={Link}
                                    to="/contacts"
                                    value="/contacts"
                                />
                                <Tab
                                    label={'Companies'}
                                    component={Link}
                                    to="/companies"
                                    value="/companies"
                                />
                                <Tab
                                    label={'Engagements'}
                                    component={Link}
                                    to="/engagements"
                                    value="/engagements"
                                />
                            </Tabs>
                        </Box>
                        <Box display="flex" alignItems="center">
                            <LoadingIndicator />
                            <UserMenu>
                                <ConfigurationMenu />
                                <CanAccess resource="sales" action="list">
                                    <UsersMenu />
                                </CanAccess>
                                <Logout />
                            </UserMenu>
                        </Box>
                    </Box>
                </Toolbar>
            </AppBar>
        </Box>
    );
};

const UsersMenu = () => {
    const { onClose } = useUserMenu() ?? {};
    return (
        <MenuItem component={Link} to="/sales" onClick={onClose}>
            <ListItemIcon>
                <PeopleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Users</ListItemText>
        </MenuItem>
    );
};

const ConfigurationMenu = () => {
    const { onClose } = useUserMenu() ?? {};
    return (
        <MenuItem component={Link} to="/settings" onClick={onClose}>
            <ListItemIcon>
                <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>My info</ListItemText>
        </MenuItem>
    );
};
export default Header;
